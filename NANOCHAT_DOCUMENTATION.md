# nanochat - Complete Technical Documentation

## Overview

**nanochat** is a minimal, hackable LLM training harness created by Andrej Karpathy. It covers the complete LLM pipeline: tokenization, pretraining, supervised fine-tuning (SFT), evaluation, inference, and a web-based chat UI. The goal is to train GPT-2 grade models (~124M-1.6B parameters) for under $100 in about 3 hours on an 8xH100 GPU node.

### Key Features
- End-to-end LLM training pipeline in minimal, readable code
- Train your own GPT-2 capable model for ~$73 (3 hours on 8xH100)
- No giant configuration objects or model factories
- Supports CUDA (H100/A100), MPS (Apple Silicon), and CPU
- FP8 training support for H100+ GPUs via torchao
- Flash Attention 3 integration with SDPA fallback
- Muon + AdamW hybrid optimizer for efficient training

---

## Project Architecture

```
nanochat/
├── runs/                    # Shell scripts for training runs
│   ├── speedrun.sh          # Main script: train GPT-2 grade model (~$73)
│   ├── miniseries.sh        # Train multiple model sizes for scaling analysis
│   ├── scaling_laws.sh      # Scaling law experiments
│   └── runcpu.sh            # Small model for CPU/MPS testing
├── nanochat/                # Core library modules
│   ├── gpt.py               # GPT Transformer model architecture
│   ├── engine.py            # Inference engine with KV cache
│   ├── optim.py             # Muon + AdamW optimizer
│   ├── dataloader.py        # Distributed tokenizing data loader
│   ├── dataset.py           # Dataset download and management
│   ├── tokenizer.py         # BPE tokenizer (rustbpe + tiktoken)
│   ├── checkpoint_manager.py # Save/load checkpoints
│   ├── flash_attention.py   # FA3 with SDPA fallback
│   ├── common.py            # Utilities (DDP, logging, etc.)
│   ├── core_eval.py         # CORE benchmark evaluation
│   ├── loss_eval.py         # Bits-per-byte evaluation
│   ├── execution.py         # Python code execution (tool use)
│   ├── report.py            # Training report generation
│   └── ui.html              # Chat web UI
├── scripts/                 # Training and evaluation scripts
│   ├── base_train.py        # Pretraining script
│   ├── base_eval.py         # Base model evaluation (CORE, BPB, samples)
│   ├── chat_sft.py          # Supervised fine-tuning
│   ├── chat_eval.py         # Chat model evaluation
│   ├── chat_rl.py           # Reinforcement learning (RLHF)
│   ├── chat_web.py          # FastAPI web server for chat
│   ├── chat_cli.py          # CLI chat interface
│   ├── tok_train.py         # Tokenizer training
│   └── tok_eval.py          # Tokenizer evaluation
├── tasks/                   # Evaluation and training tasks
│   ├── common.py            # Task base classes (TaskMixture, TaskSequence)
│   ├── mmlu.py              # MMLU benchmark
│   ├── gsm8k.py             # Grade school math with calculator
│   ├── arc.py               # ARC science questions
│   ├── humaneval.py         # Python coding task
│   ├── smoltalk.py          # SmolTalk conversation dataset
│   ├── spellingbee.py       # Spelling/counting tasks
│   └── customjson.py        # Custom JSONL conversation loader
├── dev/                     # Development and analysis tools
│   ├── gen_synthetic_data.py     # Generate identity conversations
│   ├── repackage_data_reference.py # Dataset preparation reference
│   ├── scaling_analysis.ipynb    # Scaling law analysis notebook
│   └── estimate_gpt3_core.ipynb  # GPT-3 CORE estimation
└── tests/                   # Unit tests
    ├── test_engine.py
    └── test_attention_fallback.py
```

---

## speedrun.sh - The Main Training Pipeline

`runs/speedrun.sh` is the flagship script that trains a complete GPT-2 grade model. It orchestrates the entire pipeline in about 3 hours on an 8xH100 node.

### Execution Methods

```bash
# Simplest launch
bash runs/speedrun.sh

# In a screen session (recommended for 3-hour run)
screen -L -Logfile runs/speedrun.log -S speedrun bash runs/speedrun.sh

# With wandb logging
WANDB_RUN=speedrun screen -L -Logfile runs/speedrun.log -S speedrun bash runs/speedrun.sh
```

### Pipeline Stages

#### 1. Environment Setup (Lines 14-28)

```bash
export OMP_NUM_THREADS=1
export NANOCHAT_BASE_DIR="$HOME/.cache/nanochat"
mkdir -p $NANOCHAT_BASE_DIR
```

- Sets OpenMP threads to 1 to avoid CPU contention
- Creates base directory for all artifacts (~/.cache/nanochat)
- Installs `uv` package manager if not present
- Creates Python venv and installs GPU dependencies with `uv sync --extra gpu`

#### 2. Tokenizer Training (Lines 49-65)

```bash
# Download first 8 data shards (~800MB, ~2B characters)
python -m nanochat.dataset -n 8

# Download remaining shards in background (350 shards for 10B tokens)
python -m nanochat.dataset -n 370 &
DATASET_DOWNLOAD_PID=$!

# Train BPE tokenizer with vocab size 32768
python -m scripts.tok_train

# Evaluate tokenizer compression ratio
python -m scripts.tok_eval
```

**Key Details:**
- Downloads FineWeb-Edu dataset shards from HuggingFace
- Each shard is ~100MB compressed, ~250M characters
- Tokenizer uses rustbpe for training, tiktoken for inference
- Vocab size: 2^15 = 32,768 tokens
- GPT-4 style regex pattern for splitting

#### 3. Base Model Pretraining (Lines 68-76)

```bash
# Wait for dataset download
wait $DATASET_DOWNLOAD_PID

# Train d24 model (24 layers) with slight overtraining
torchrun --standalone --nproc_per_node=8 -m scripts.base_train -- \
    --depth=24 \
    --target-param-data-ratio=12 \
    --device-batch-size=16 \
    --run=$WANDB_RUN

# Evaluate: CORE metric, BPB, and samples
torchrun --standalone --nproc_per_node=8 -m scripts.base_eval -- --device-batch-size=16
```

**Key Details:**
- `depth=24`: 24-layer Transformer (GPT-2 scale)
- `target-param-data-ratio=12`: Slightly overtrained (Chinchilla optimal is ~20)
- Model dimensions auto-calculated: dim = depth * 64 (aspect ratio)
- Total batch size: 524,288 tokens per step
- Training uses Muon optimizer for matrices, AdamW for embeddings

#### 4. Supervised Fine-Tuning (Lines 78-87)

```bash
# Download synthetic identity conversations (2.3MB)
curl -L -o $NANOCHAT_BASE_DIR/identity_conversations.jsonl \
    https://karpathy-public.s3.us-west-2.amazonaws.com/identity_conversations.jsonl

# Run SFT
torchrun --standalone --nproc_per_node=8 -m scripts.chat_sft -- \
    --device-batch-size=16 \
    --run=$WANDB_RUN

# Evaluate chat model
torchrun --standalone --nproc_per_node=8 -m scripts.chat_eval -- -i sft
```

**SFT Data Mixture:**
- SmolTalk: 460K general conversations
- MMLU auxiliary_train: 100K multiple choice problems
- GSM8K: 16K math problems (2 epochs)
- Identity conversations: 2K synthetic personality data (2 epochs)
- SimpleSpelling: 200K spelling tasks
- SpellingBee: 80K letter counting tasks

#### 5. Optional Chat Interfaces (Lines 89-93)

```bash
# CLI chat
python -m scripts.chat_cli -p "Why is the sky blue?"

# Web UI
python -m scripts.chat_web
```

#### 6. Report Generation (Line 97)

```bash
python -m nanochat.report generate
```

Generates a comprehensive markdown report with all training metrics.

---

## Core Library Modules (nanochat/)

### gpt.py - GPT Transformer Architecture

The heart of nanochat - a modern GPT implementation with several optimizations:

**GPTConfig Dataclass:**
```python
@dataclass
class GPTConfig:
    sequence_len: int = 2048
    vocab_size: int = 32768
    n_layer: int = 12
    n_head: int = 6
    n_kv_head: int = 6        # GQA support
    n_embd: int = 768
    window_pattern: str = "SSSL"  # Sliding window pattern
```

**Architecture Features:**
- **Rotary Positional Embeddings (RoPE)**: No learned positional embeddings
- **QK Norm**: Normalizes queries and keys before attention
- **ReLU^2 activation**: MLP uses `F.relu(x).square()` instead of GELU
- **RMS Norm**: Parameter-free RMS normalization
- **No bias**: All linear layers have no bias
- **Untied embeddings**: Separate input/output embedding matrices
- **Value Embeddings (VE)**: ResFormer-style value residuals on alternating layers
- **Sliding Window Attention**: Pattern like "SSSL" = 3 short windows + 1 long
- **Logit Softcap**: Caps logits to [-15, 15] for stable training

**Residual Lambda Scaling:**
```python
# Per-layer learnable scalars
x = self.resid_lambdas[i] * x + self.x0_lambdas[i] * x0
```
- `resid_lambdas`: Scales residual stream (init 1.0)
- `x0_lambdas`: Blends back initial embedding (init 0.1)

### optim.py - MuonAdamW Optimizer

Hybrid optimizer combining Muon for matrix parameters and AdamW for embeddings/scalars.

**Muon Algorithm:**
1. Nesterov momentum update
2. **Polar Express orthogonalization**: Newton-Schulz iteration to approximate UV^T
3. Variance reduction with factored second moment
4. Cautious weight decay (only on aligned parameters)

**Key Properties:**
- Matrix params (Muon): `lr=0.02`, orthogonalizing update
- Embedding params (AdamW): `lr=0.2-0.3`
- Unembedding params (AdamW): `lr=0.004`
- Fused compiled kernels for efficiency

**Distributed Version (DistMuonAdamW):**
- ZeRO-2 style optimizer state sharding
- 3-phase async communication (reduce → compute → gather)
- Large params: reduce_scatter gradients, all_gather updates
- Small params: all_reduce gradients

### dataloader.py - Distributed Data Loading

BOS-aligned dataloader with best-fit packing:

**Key Properties:**
- Every row starts with BOS token
- Best-fit algorithm minimizes document cropping
- 100% utilization (no padding)
- ~35% tokens cropped when documents don't fit

**Algorithm:**
1. From buffer, pick largest doc that fits entirely
2. Repeat until nothing fits
3. Crop shortest doc to fill remaining space exactly

**Buffer Management:**
- Pre-allocated pinned CPU buffer for staging
- Single H2D transfer per batch
- GPU buffer for training tensors

### engine.py - Inference Engine

Efficient autoregressive generation with KV cache:

**KVCache Class:**
```python
class KVCache:
    # FA3-style layout: (n_layers, B, T, H, D)
    k_cache = torch.zeros(num_layers, batch_size, seq_len, num_heads, head_dim)
    v_cache = torch.zeros(...)
    cache_seqlens = torch.zeros(batch_size, dtype=torch.int32)  # Position tracker
```

**Generation Features:**
- Batch=1 prefill, then clone KV cache for multiple samples
- Tool use state machine for calculator
- Handles `<|python_start|>...<|python_end|>` for tool calls
- Injects `<|output_start|>result<|output_end|>` automatically

**Calculator Tool:**
- Safe eval with timeout
- Math expressions: `5+3*2`
- String operations: `"strawberry".count("r")`
- Dangerous patterns blocked

### tokenizer.py - BPE Tokenizer

Two implementations available:

**RustBPETokenizer (default):**
- Training: rustbpe (fast Rust implementation)
- Inference: tiktoken (OpenAI's tokenizer)
- GPT-4 style regex pattern with `\p{N}{1,2}` (2-digit numbers)

**Special Tokens:**
```python
SPECIAL_TOKENS = [
    "<|bos|>",           # Beginning of sequence
    "<|user_start|>",    # User message markers
    "<|user_end|>",
    "<|assistant_start|>",
    "<|assistant_end|>",
    "<|python_start|>",  # Tool use markers
    "<|python_end|>",
    "<|output_start|>",
    "<|output_end|>",
]
```

**render_conversation():**
Converts chat messages to token IDs with mask:
- mask=0: User messages (not trained on)
- mask=1: Assistant responses (trained on)

### flash_attention.py - Unified Attention Interface

Automatic FA3/SDPA switching:

```python
from nanochat.flash_attention import flash_attn

# Training
y = flash_attn.flash_attn_func(q, k, v, causal=True, window_size=window_size)

# Inference with KV cache
y = flash_attn.flash_attn_with_kvcache(q, k_cache, v_cache, k=k, v=v, ...)
```

**Backend Selection:**
- Hopper (sm90): Flash Attention 3 via kernels package
- Ada, Blackwell, CPU, MPS: PyTorch SDPA fallback
- Sliding window support in both backends

### checkpoint_manager.py - Model Persistence

**Save Format:**
- `model_{step:06d}.pt`: Model state dict
- `optim_{step:06d}_rank{rank}.pt`: Per-rank optimizer state (sharded)
- `meta_{step:06d}.json`: Metadata (config, step, loss)

**Load Functions:**
- `load_model(source, device, phase)`: Load from "base", "sft", or "rl"
- Auto-detects largest model and latest step if not specified
- Patches missing config keys for backward compatibility

### common.py - Utilities

**Compute Initialization:**
```python
ddp, ddp_rank, ddp_local_rank, ddp_world_size, device = compute_init(device_type)
```
- Handles DDP with torchrun
- Auto-detects CUDA > MPS > CPU
- Sets TF32 precision for CUDA

**GPU Peak FLOPS Table:**
```python
# Supports H100, H200, A100, L40S, B200, MI300X, RTX 4090/5090, etc.
get_peak_flops("H100 SXM")  # Returns 989e12
```

---

## Training Scripts (scripts/)

### base_train.py - Pretraining

**Key Arguments:**
```bash
--depth=24              # Model depth (layers)
--aspect-ratio=64       # model_dim = depth * aspect_ratio
--head-dim=128          # Attention head dimension
--max-seq-len=2048      # Context length
--window-pattern=SSSL   # Sliding window pattern
--device-batch-size=32  # Per-GPU batch size
--total-batch-size=524288  # Global batch size
--fp8                   # Enable FP8 training (H100+)
```

**Training Loop Features:**
- Gradient accumulation for large batch sizes
- LR warmup/warmdown scheduler
- Muon momentum ramp (0.85 → 0.95)
- Linear weight decay decay to zero
- Periodic CORE metric evaluation
- GC management to avoid Python overhead

**FP8 Training:**
```python
from torchao.float8 import Float8LinearConfig, convert_to_float8_training
convert_to_float8_training(model, config=fp8_config, module_filter_fn=fp8_module_filter)
```
- Converts eligible Linear layers to Float8Linear
- ~4% speedup on H100
- Disabled during evaluation for consistent results

### chat_sft.py - Supervised Fine-Tuning

**Data Mixture:**
```python
train_dataset = TaskMixture([
    SmolTalk(split="train"),           # 460K conversations
    MMLU(subset="auxiliary_train"),    # 100K multiple choice
    GSM8K(subset="main", split="train"),  # 8K math (x2 epochs)
    CustomJSON(filepath=identity_conversations_filepath),  # 1K identity
    SimpleSpelling(size=200000),       # 200K spelling
    SpellingBee(size=80000),           # 80K counting
])
```

**BOS-Aligned Bestfit-Pad:**
- Every row starts with BOS
- No cropping - pad instead when nothing fits
- Padding positions masked with -1 (ignored in loss)

### base_eval.py - Evaluation

**Evaluation Modes:**
- `--eval core`: CORE metric (In-Context Learning accuracy)
- `--eval bpb`: Bits-per-byte on train/val splits
- `--eval sample`: Generate text samples

**CORE Benchmark:**
- Downloads eval_bundle.zip with task configs
- Tasks: MMLU, HellaSwag, ARC, WinoGrande, PIQA, etc.
- Computes centered accuracy (normalized against random baseline)
- GPT-2 (1.6B) CORE score: 0.256525

### chat_web.py - Web Server

FastAPI server with data parallelism:

**Architecture:**
- WorkerPool distributes requests across GPUs
- Each GPU loads full model copy
- Async worker acquisition/release

**Endpoints:**
- `GET /`: Chat UI (serves ui.html)
- `POST /chat/completions`: Streaming chat API
- `GET /health`: Worker pool status
- `GET /stats`: GPU utilization

**Abuse Prevention:**
- Max 500 messages per request
- Max 8000 chars per message
- Max 32000 chars total
- Temperature: 0.0-2.0
- Top-k: 0-200

---

## Task Definitions (tasks/)

### common.py - Base Classes

**Task:**
- Base class for all datasets
- Supports slicing (start, stop, step)
- Methods: `num_examples()`, `get_example(index)`, `evaluate()`

**TaskMixture:**
- Combines multiple tasks for SFT
- Deterministically shuffles all examples
- Oversample by passing same task multiple times

**TaskSequence:**
- Sequential training curriculum
- No shuffling between tasks

### Task Implementations

| Task | Purpose | Size |
|------|---------|------|
| SmolTalk | General conversations | 460K train, 24K test |
| MMLU | Multiple choice questions | 100K auxiliary_train |
| GSM8K | Grade school math + calculator | 8K train, 1.3K test |
| ARC | Science multiple choice | Varies |
| HumanEval | Python coding | ~150 problems |
| SpellingBee | Letter counting | Generated on-the-fly |
| SimpleSpelling | Spell words | Generated on-the-fly |

**render_mc() for Multiple Choice:**
```
Multiple Choice question: What is 2+2?
- 3=A
- 4=B
- 5=C

Respond only with the letter of the correct answer.
```

---

## Dataset (nanochat/dataset.py)

**Data Source:**
- FineWeb-Edu 100B tokens (shuffled)
- HuggingFace: `karpathy/fineweb-edu-100b-shuffle`
- 1822 shards total, ~100MB each

**Download:**
```bash
python -m nanochat.dataset -n 370  # Download 370 shards (~10B tokens)
```

**Features:**
- Parallel downloads with retry/backoff
- Temp files to avoid partial downloads
- Auto-skip existing files

---

## Benchmarks and Leaderboard

**Primary Metric:** Time to GPT-2 CORE (0.256525)

| # | Time | val_bpb | CORE | Description |
|---|------|---------|------|-------------|
| 0 | 168h | - | 0.2565 | Original GPT-2 (2019) |
| 1 | 3.04h | 0.74833 | 0.2585 | d24 baseline |
| 2 | 2.91h | 0.74504 | 0.2578 | d26 + FP8 |

**CORE Benchmark:**
- Evaluates in-context learning ability
- Tasks from DCLM paper
- Centered accuracy = (acc - random) / (1 - random)

---

## Key Design Decisions

1. **Depth as Single Dial:** Model size controlled by layer count only
2. **Aspect Ratio 64:** `model_dim = depth * 64`
3. **Head Dim 128:** Consistent head size for FA3 compatibility
4. **Muon for Matrices:** Orthogonalizing optimizer for better gradients
5. **No DDP:** Custom distributed optimizer (ZeRO-2 style) without PyTorch DDP
6. **Best-fit Packing:** Maximize document usage, minimize cropping
7. **Tool Use:** Calculator for math and string operations
8. **Sliding Window:** Alternating short/long attention patterns

---

## Running on Different Hardware

**8xH100 (recommended):**
```bash
bash runs/speedrun.sh
```

**8xA100:**
Same script, but ~30% slower, no FP8 support.

**Single GPU:**
```bash
# Omit torchrun, uses gradient accumulation
python -m scripts.base_train --depth=24 --device-batch-size=16
```

**CPU/MPS (tiny model for testing):**
```bash
bash runs/runcpu.sh
# Or manually:
python -m scripts.base_train --depth=4 --max-seq-len=512 --device-batch-size=1
```

---

## Quick Start

```bash
# 1. Clone repo
git clone https://github.com/karpathy/nanochat
cd nanochat

# 2. Train GPT-2 grade model (requires 8xH100)
bash runs/speedrun.sh

# 3. Chat with your model
python -m scripts.chat_web
# Open http://your-ip:8000
```

---

## References

- [nanochat GitHub](https://github.com/karpathy/nanochat)
- [modded-nanoGPT](https://github.com/KellerJordan/modded-nanogpt) (inspiration)
- [Muon optimizer](https://kellerjordan.github.io/posts/muon/)
- [FineWeb-Edu dataset](https://huggingface.co/datasets/HuggingFaceFW/fineweb-edu)
- [DCLM paper](https://arxiv.org/abs/2406.11794) (CORE benchmark)
- [Polar Express](https://arxiv.org/pdf/2505.16932) (orthogonalization)
