# Grok System Design Interview

> A comprehensive guide to system design interviews — covering interview frameworks, 12 real-world design problems, and foundational distributed systems concepts.

---

## Table of Contents

1. [System Design Interview Framework](#system-design-interview-framework)
2. [Designing a URL Shortening Service (TinyURL)](#designing-a-url-shortening-service-tinyurl)
3. [Designing Pastebin](#designing-pastebin)
4. [Designing Instagram](#designing-instagram)
5. [Designing Dropbox](#designing-dropbox)
6. [Designing Facebook Messenger](#designing-facebook-messenger)
7. [Designing Twitter](#designing-twitter)
8. [Designing YouTube / Netflix](#designing-youtube--netflix)
9. [Designing Typeahead Suggestion](#designing-typeahead-suggestion)
10. [Designing an API Rate Limiter](#designing-an-api-rate-limiter)
11. [Designing Twitter Search](#designing-twitter-search)
12. [Designing a Web Crawler](#designing-a-web-crawler)
13. [Designing Facebook's Newsfeed](#designing-facebooks-newsfeed)
14. [Designing Yelp / Proximity Server](#designing-yelp--proximity-server)
15. [Designing an Online Movie Ticket Booking System](#designing-an-online-movie-ticket-booking-system)
16. [System Design Basics](#system-design-basics)
    - [Scalability](#scalability)
    - [Load Balancing](#load-balancing)
    - [Caching](#caching)
    - [Sharding / Data Partitioning](#sharding--data-partitioning)
    - [Indexes](#indexes)
    - [Proxies](#proxies)
    - [SQL vs. NoSQL](#sql-vs-nosql)
    - [CAP Theorem](#cap-theorem)
    - [Consistent Hashing](#consistent-hashing)
    - [Long-Polling vs. WebSockets vs. Server-Sent Events](#long-polling-vs-websockets-vs-server-sent-events)

---

## System Design Interview Framework

A lot of software engineers struggle with system design interviews (SDIs) primarily because of three reasons:

- The unstructured nature of SDIs, where they are asked to work on an open-ended design problem that doesn't have a standard answer.
- Their lack of experience in developing large-scale systems.
- They did not prepare for SDIs.

Like coding interviews, candidates who haven't put a conscious effort to prepare for SDIs mostly perform poorly, especially at top companies like Google, Facebook, Amazon, and Microsoft.

In SDIs, we follow a step-by-step approach to solve multiple design problems. Here are the steps:

### Step 1: Requirements Clarifications

It is always a good idea to ask questions about the exact scope of the problem we are solving. Design questions are mostly open-ended, and they don't have ONE correct answer. Clarifying ambiguities early in the interview is critical.

Example questions for designing a Twitter-like service:
- Will users be able to post tweets and follow other people?
- Should we design the user's timeline?
- Will tweets contain photos and videos?
- Are we focusing on the backend only or also the front-end?
- Will users be able to search tweets?
- Do we need to display hot trending topics?
- Will there be push notifications for new tweets?

### Step 2: System Interface Definition

Define what APIs are expected from the system. This establishes the exact contract and ensures requirements aren't misunderstood. Examples for a Twitter-like service:

```
postTweet(user_id, tweet_data, tweet_location, user_location, timestamp, …)
generateTimeline(user_id, current_time, user_location, …)
markTweetFavorite(user_id, tweet_id, timestamp, …)
```

### Step 3: Back-of-the-Envelope Estimation

Estimate the scale of the system to guide scaling, partitioning, load balancing, and caching decisions:
- What scale is expected (number of new tweets, tweet views, timeline generations per second)?
- How much storage will be needed?
- What network bandwidth usage is expected?

### Step 4: Defining Data Model

Defining the data model early clarifies how data flows among different components and guides data partitioning and management. Identify entities, their interactions, and aspects of data management (storage, transportation, encryption).

Example entities for Twitter:
- `User`: UserID, Name, Email, DoB, CreationDate, LastLogin
- `Tweet`: TweetID, Content, TweetLocation, NumberOfLikes, TimeStamp
- `UserFollow`: UserID1, UserID2
- `FavoriteTweets`: UserID, TweetID, TimeStamp

Key questions: Which database system? NoSQL like Cassandra or SQL like MySQL? What block storage for photos/videos?

### Step 5: High-Level Design

Draw a block diagram with 5–6 boxes representing the core components. Identify the components needed to solve the problem end-to-end.

For Twitter, at a high level:
- Multiple application servers with load balancers in front
- Separate servers for read-heavy vs. write traffic
- Efficient backend database for tweets
- Distributed file storage for photos and videos

### Step 6: Detailed Design

Dig deeper into two or three components; interviewer feedback should guide which parts need further discussion. Present different approaches, their pros and cons, and explain trade-offs.

Key questions:
- How to partition data to distribute it to multiple databases?
- How to handle hot users who tweet a lot?
- How to optimize storage for scanning the latest data?
- How much cache to introduce and at which layer?
- What components need better load balancing?

### Step 7: Identifying and Resolving Bottlenecks

Discuss as many bottlenecks as possible and approaches to mitigate them:
- Is there any single point of failure? How to mitigate it?
- Do we have enough data replicas if servers go down?
- Do we have enough service copies so a few failures don't cause total shutdown?
- How are we monitoring performance and getting alerts when components fail?

---

## Designing a URL Shortening Service (TinyURL)

> **Difficulty Level:** Easy | Similar Services: bit.ly, goo.gl, qlink.me


### 1. Why URL Shortening?

URL shortening creates shorter aliases ("short links") for long URLs. Users are redirected to the original URL when they visit these short links. Short links save space when displayed, printed, messaged, or tweeted, and users are less likely to mistype shorter URLs.

For example, shortening `https://www.educative.io/collection/page/5668639101419520/...` yields `http://tinyurl.com/jlg8zpc` — nearly one-third the size.

URL shortening is used for optimizing links across devices, tracking individual links for analytics, and hiding affiliated original URLs.

### 2. Requirements and Goals

**Functional Requirements:**
1. Given a URL, the service generates a shorter and unique alias (short link).
2. When users access a short link, the service redirects them to the original link.
3. Users can optionally pick a custom short link.
4. Links expire after a default timespan; users can specify expiration time.

**Non-Functional Requirements:**
1. The system should be highly available (if the service is down, all URL redirections fail).
2. URL redirection should happen in real-time with minimal latency.
3. Shortened links should not be guessable (not predictable).

**Extended Requirements:**
1. Analytics (e.g., how many times a redirection happened).
2. REST API accessibility by other services.

### 3. Capacity Estimation and Constraints

The system will be **read-heavy** with a 100:1 read/write ratio.

**Traffic estimates** (assuming 500M new URL shortenings per month):
- New URLs: `500M / (30 × 24 × 3600) ≈ 200 URLs/s`
- URL redirections: `100 × 200 = 20,000/s`

**Storage estimates** (5 years, 500 bytes per object):
- Total objects: `500M × 12 months × 5 years = 30 billion`
- Total storage: `30B × 500 bytes = 15 TB`

**Bandwidth estimates:**
- Incoming (writes): `200 × 500 bytes = 100 KB/s`
- Outgoing (reads): `20K × 500 bytes ≈ 10 MB/s`

**Memory estimates** (caching 20% of hot URLs using the 80-20 rule):
- Daily requests: `20K × 3600 × 24 ≈ 1.7 billion`
- Cache memory: `0.2 × 1.7B × 500 bytes ≈ 170 GB`

| Metric | Estimate |
|--------|----------|
| New URLs | 200/s |
| URL Redirections | 20,000/s |
| Incoming data | 100 KB/s |
| Outgoing data | 10 MB/s |
| Storage (5 years) | 15 TB |
| Memory for cache | 170 GB |

### 4. System APIs

```
createURL(api_dev_key, original_url, custom_alias=None, user_name=None, expire_date=None)
```

Parameters:
- `api_dev_key` (string): API developer key for throttling users based on their quota.
- `original_url` (string): URL to be shortened.
- `custom_alias` (string): Optional custom key for the URL.
- `user_name` (string): Optional user name to be used in encoding.
- `expire_date` (string): Optional expiration date for the shortened URL.
- Returns: shortened URL string or error code.

```
deleteURL(api_dev_key, url_key)
```

Returns `'URL Removed'` on success.

**Preventing abuse:** Limit each `api_dev_key` to a certain number of URL creations and redirections per time period.

### 5. Database Design

**Observations:**
1. Need to store billions of records.
2. Each object is small (less than 1 KB).
3. No relationships between records except which user created a URL.
4. Read-heavy service.

**Database Schema:**

| URL Table | User Table |
|-----------|------------|
| Hash: varchar(16) (PK) | UserID: int (PK) |
| OriginalURL: varchar(512) | Name: varchar(20) |
| CreationDate: datetime | Email: varchar(32) |
| ExpirationDate: datetime | CreationDate: datetime |
| UserID: int | LastLogin: datetime |

**Database choice:** NoSQL key-value store (DynamoDB, Cassandra, or Riak) is better — no relationships needed, easier to scale, can store billions of rows.

### 6. Basic System Design and Algorithm

**a. Encoding the Actual URL**

Compute a unique hash (MD5 or SHA256) of the given URL, then encode it in base64. A 6-letter key with base64 encoding yields 64^6 ≈ 68.7 billion possible strings.

Issues with this approach:
1. Multiple users entering the same URL get the same shortened URL.
2. URL-encoded versions of the same URL result in different keys.

Workaround: Append an increasing sequence number or UserID to the URL before hashing.

**b. Generating Keys Offline (Key Generation Service — KGS)**

A standalone KGS generates random 6-letter strings beforehand and stores them in a key-DB. This approach:
- Avoids encoding complexity
- Eliminates duplication/collision concerns
- KGS uses two tables: "unused keys" and "used keys"
- KGS keeps some keys in memory for fast delivery

**Concurrency:** KGS must synchronize (lock) the data structure holding keys before giving them to servers.

**Key-DB size:** `6 bytes × 68.7B keys = 412 GB`

**Single point of failure:** Maintain a standby replica of KGS for failover.

**Key lookup:** HTTP 302 Redirect (found) or HTTP 404 Not Found.

**Custom aliases:** Max 16 characters; not mandatory but size-limited.

### 7. Data Partitioning and Replication

**a. Range-Based Partitioning:** Store URLs in partitions based on the first letter of the hash key. Problem: Can lead to unbalanced servers (e.g., too many URLs starting with 'E').

**b. Hash-Based Partitioning:** Take a hash of the key/URL and map it to a partition number (e.g., [1…256]). Problem: Can still lead to overloaded partitions — solved with Consistent Hashing.

### 8. Cache

- Use off-the-shelf solutions like Memcache to store full URLs with their hashes.
- Start with 20% of daily traffic (≈170 GB, fits on one modern server with 256 GB RAM).
- **Cache eviction policy:** Least Recently Used (LRU).
- Replicate caching servers to distribute load; all replicas update when cache misses occur.

### 9. Load Balancer

Place load balancers at three points:
1. Between Clients and Application servers
2. Between Application Servers and Database servers
3. Between Application Servers and Cache servers

Simple Round Robin initially; upgrade to intelligent LB that queries server load if needed.

### 10. Purging / DB Cleanup

Use **lazy cleanup** instead of active searching for expired links:
- Delete expired links when a user tries to access them.
- A lightweight Cleanup Service runs periodically (during low-traffic periods) to remove expired links.
- Default expiration time: two years.
- After removing an expired link, put the key back into key-DB for reuse.

### 11. Telemetry

Track statistics: country of visitor, date/time of access, referring web page, browser/platform. For popular URLs, avoid updating a single DB row on every view (use aggregation/sampling).

### 12. Security and Permissions

- Store permission level (public/private) with each URL.
- A separate table stores UserIDs with permission to see a specific private URL.
- If unauthorized, return HTTP 401.

---

## Designing Pastebin

> **Difficulty Level:** Easy | Similar Services: pastebin.com, pasted.co, chopapp.com


### 1. What is Pastebin?

Pastebin-like services enable users to store plain text or images over the network and generate unique URLs to access the uploaded data. Users share data quickly by passing the URL.

### 2. Requirements and Goals

**Functional Requirements:**
1. Users can upload ("paste") text and get a unique URL.
2. Only text uploads are supported.
3. Data and links expire automatically; users can specify expiration time.
4. Users can optionally pick a custom alias.

**Non-Functional Requirements:**
1. Highly reliable — uploaded data should never be lost.
2. Highly available — users must be able to access pastes.
3. Real-time access with minimum latency.
4. Paste links should not be guessable.

**Extended Requirements:**
1. Analytics (e.g., how many times a paste was accessed).
2. REST API accessibility.

### 3. Design Considerations

- **Paste size limit:** Max 10 MB to prevent abuse.
- **Custom URL size limit:** Enforce to maintain a consistent URL database.

### 4. Capacity Estimation and Constraints

Read-heavy service with 5:1 read/write ratio.

- New pastes per day: 1 million
- Reads per day: 5 million
- New pastes per second: `1M / 86400 ≈ 12 pastes/s`
- Reads per second: `5M / 86400 ≈ 58 reads/s`

**Storage estimates** (average paste = 10 KB):
- Per day: `1M × 10 KB = 10 GB/day`
- For 10 years: `10 GB × 365 × 10 ≈ 36 TB`
- With 70% capacity model: `36 TB / 0.7 ≈ 51.4 TB`

**Key storage** (6-char base64 keys for 3.6B pastes in 10 years): `3.6B × 6 bytes ≈ 22 GB`

**Bandwidth estimates:**
- Ingress: `12 × 10 KB = 120 KB/s`
- Egress: `58 × 10 KB ≈ 0.6 MB/s`

**Memory for cache** (20% of daily reads): `0.2 × 5M × 10 KB ≈ 10 GB`

### 5. System APIs

```
addPaste(api_dev_key, paste_data, custom_url=None, user_name=None, paste_name=None, expire_date=None)
```
Returns: URL to access the paste or error code.

```
getPaste(api_dev_key, api_paste_key)
```
Returns: Textual data of the paste.

```
deletePaste(api_dev_key, api_paste_key)
```
Returns: `true` on success, `false` on failure.

### 6. Database Design

**Observations:**
1. Billions of records needed.
2. Each metadata object is small (< 100 bytes).
3. Each paste content can be medium size (up to a few MB).
4. No relationships between records (except user-paste ownership).
5. Read-heavy service.

**Database Schema:**

| Paste Table | User Table |
|-------------|------------|
| URLHash: varchar(16) (PK) | UserID: int (PK) |
| ContentKey: varchar(512) | Name: varchar(20) |
| ExpirationDate: datetime | Email: varchar(32) |
| UserID: int | CreationDate: datetime |
| CreationDate: datetime | LastLogin: datetime |

`ContentKey` is the object key pointing to the paste's content in object storage.

### 7. High-Level Design

Two layers:
1. **Application layer** — handles all read/write requests.
2. **Storage layer** — split into:
   - **Metadata storage:** Relational DB (MySQL) or Distributed Key-Value (Cassandra/Dynamo) for metadata.
   - **Object storage:** Amazon S3 (or similar) for paste content.

This split allows independent scaling of metadata and content.

### 8. Component Design

**a. Application Layer**

- **Write request:** Generate a 6-letter random key; if duplicate, retry. Alternative: use a Key Generation Service (KGS) — same design as TinyURL.
- **Read request:** Look up the key, retrieve content from object storage.

KGS uses two tables (unused keys / used keys); standby replica prevents single point of failure.

**b. Datastore Layer**
1. **Metadata Database:** MySQL or Cassandra/Dynamo.
2. **Object Storage:** Amazon S3; scale by adding more servers.

### 9–12. Additional Considerations

For **Purging/DB Cleanup**, **Data Partitioning and Replication**, **Cache and Load Balancer**, and **Security and Permissions**, refer to the same strategies described in the URL Shortening service section.

---

## Designing Instagram

> **Difficulty Level:** Medium | Similar Services: Flickr, Picasa


### 1. What is Instagram?

Instagram is a social networking service that enables users to upload and share photos and videos publicly or privately. For this exercise, we design a simpler version: users can share photos and follow other users. Each user's News Feed consists of top photos from the people they follow.

### 2. Requirements and Goals

**Functional Requirements:**
1. Users can upload/download/view photos.
2. Users can search based on photo/video titles.
3. Users can follow other users.
4. The system generates and displays a user's News Feed (top photos from people they follow).

**Non-Functional Requirements:**
1. Highly available.
2. Acceptable latency of 200ms for News Feed generation.
3. Consistency can take a hit (if a user doesn't see a photo for a while, it's fine).
4. Highly reliable — uploaded photos/videos should never be lost.

*Not in scope:* Adding tags, commenting on photos, tagging users to photos, who-to-follow recommendations.

### 3. Design Considerations

- Read-heavy system; focus on fast photo retrieval.
- Efficient storage management is crucial.
- Low latency while viewing photos.
- 100% data reliability — uploaded photos are never lost.

### 4. Capacity Estimation and Constraints

- 500M total users; 1M daily active users.
- 2M new photos/day; 23 new photos/second.
- Average photo file size: 200 KB.
- Space per day: `2M × 200 KB = 400 GB/day`
- Space for 10 years: `400 GB × 365 × 10 ≈ 1,425 TB`

### 5. High-Level System Design

Two scenarios: uploading photos and viewing/searching photos.

Need:
- Object storage servers for photos.
- Database servers for photo metadata.

### 6. Database Schema

**User Table:** UserID, Name, Email, DateOfBirth, CreationDate, LastLogin (68 bytes per row)  
**Photo Table:** PhotoID, UserID, PhotoPath, PhotoLatitude, PhotoLongitude, UserLatitude, UserLongitude, CreationDate (284 bytes per row)  
**UserFollow Table:** UserID1, UserID2 (8 bytes per row)

**Storage estimates for 10 years:**
- User table: `500M × 68 bytes ≈ 32 GB`
- Photo table: `2M/day × 284 bytes × 365 × 10 ≈ 1.88 TB`
- UserFollow table: `500M × 500 followers × 8 bytes ≈ 1.82 TB`
- **Total: ~3.7 TB**

**Database choice:** Use Cassandra (wide-column datastore) for `UserPhoto` and `UserFollow` tables (key: UserID, value: list of PhotoIDs). Photos stored in HDFS or S3.

### 7. Component Design

Photo uploads (writes) are slow (disk I/O); reads are faster (served from cache). To avoid writes consuming all connections:
- **Separate servers for reads and writes.**
- This allows independent scaling and optimization of each operation.

### 8. Reliability and Redundancy

- Store multiple copies of each file on different storage servers.
- Run multiple replicas of each service to eliminate single points of failure.
- If only one instance must run at a time, maintain a redundant secondary instance ready for failover.

### 9. Data Sharding

**a. Partitioning based on UserID:**
- All photos of a user on the same shard (shard = UserID % 10).
- Issues: hot users, non-uniform storage distribution, unavailability if shard is down.

**b. Partitioning based on PhotoID (preferred):**
- Generate unique PhotoIDs first, then shard by PhotoID % 10.
- PhotoID = epoch time (31 bits) + auto-incrementing sequence (9 bits) = 40 bits.
- Use two key-generating DB servers (one even, one odd) behind a load balancer to prevent single point of failure.

### 10. Ranking and News Feed Generation

**Simple approach:** Fetch latest 100 photos from each followed user, rank by recency/likes, return top 100.

**Problem:** High latency (querying multiple tables, sorting/merging).

**Better approach — Pre-generate News Feed:**
- Dedicated servers continuously generate users' News Feeds and store them in a `UserNewsFeed` table.
- On user request, simply query this table.

**Sending News Feed to Users:**
1. **Pull:** Client requests feed periodically. Problem: stale data, empty responses.
2. **Push:** Server pushes new data via Long Poll. Problem: celebrity users with millions of followers.
3. **Hybrid:** Pull for users with high follower counts (celebrities), push for users with few follows.

### 11. News Feed Creation with Sharded Data

Embed creation time in PhotoID to sort efficiently:
- PhotoID = epoch time (31 bits) + auto-increment sequence (9 bits)
- Primary index on PhotoID → fast retrieval of latest photos.

### 12. Cache and Load Balancing

- Use CDNs for geographically distributed photo delivery.
- Memcache for metadata server hot rows.
- **Eviction policy:** LRU (Least Recently Used).
- Cache 20% of daily read volume (80-20 rule).

---

## Designing Dropbox

> **Difficulty Level:** Medium | Similar Services: Google Drive, OneDrive


### 1. Why Cloud Storage?

Cloud file storage simplifies storage and exchange of digital resources across devices. Key benefits:
- **Availability:** Access files from any device, anywhere, anytime.
- **Reliability and Durability:** Multiple copies on geographically distributed servers — data is never lost.
- **Scalability:** Unlimited storage as long as you pay for it.

### 2. Requirements and Goals

1. Users can upload and download files/photos from any device.
2. Users can share files or folders with other users.
3. Automatic synchronization between devices — updating a file on one device syncs to all devices.
4. Support for large files up to 1 GB.
5. **ACID-ity** is required (Atomicity, Consistency, Isolation, Durability).
6. Support offline editing — sync changes when the user comes back online.

**Extended Requirements:**
- Snapshotting for version history.

### 3. Design Considerations

- Huge read and write volumes; read/write ratio nearly 1:1.
- Files stored in small chunks (4 MB each): failed operations only retry failed chunks.
- Transfer only updated chunks to reduce data exchange.
- Remove duplicate chunks to save storage and bandwidth.
- Keep local copy of metadata (file name, size) to reduce round trips.
- For small changes, upload only diffs instead of whole chunks.

### 4. Capacity Estimation

- 500M total users; 100M daily active users (DAU).
- Average 3 devices per user.
- Average 200 files/photos per user → 100 billion total files.
- Average file size: 100 KB → total storage: `100B × 100 KB = 10 PB`
- 1 million active connections per minute.

### 5. High-Level Design

The user designates a workspace folder. Any file placed there is uploaded to the cloud; modifications sync across all devices.

Core components:
- **Block Servers** — handle file upload/download with clients.
- **Metadata Servers** — keep file metadata updated in a SQL or NoSQL database.
- **Synchronization Servers** — notify all clients of changes for synchronization.

### 6. Component Design

**a. Client**

The client monitors the workspace folder and syncs files with remote Cloud Storage.

Essential operations:
1. Upload and download files.
2. Detect file changes in the workspace folder.
3. Handle conflicts from offline or concurrent updates.

Client is divided into four parts:
1. **Internal Metadata Database** — tracks all files, chunks, versions, and locations.
2. **Chunker** — splits files into chunks (4 MB each); detects modified parts, transfers only those.
3. **Watcher** — monitors local workspace; notifies Indexer of changes; listens for changes from other clients.
4. **Indexer** — processes Watcher events; updates Internal Metadata DB; communicates with Synchronization Service.

**Efficient file transfer:** Break files into 4 MB chunks; transfer only modified chunks. Calculate hash (SHA-256) to compare versions.

**Listening for changes:** Use **HTTP Long Polling** — the client requests updates; the server holds the request open until new data is available, then responds immediately.

**Slow servers:** Clients should exponentially back off (exponential backoff) if the server is busy.

**Mobile clients:** Sync on demand to save bandwidth.

**b. Metadata Database**

Maintains versioning and metadata for files/chunks, users, and workspaces. Can be MySQL (natively supports ACID) or DynamoDB (requires ACID implemented in Synchronization Service logic).

Stores: Chunks, Files, Users, Devices, Workspaces.

**c. Synchronization Service**

The most important component — processes file updates from clients and applies changes to all subscribed clients. Keeps clients' local databases in sync with the remote Metadata DB.

Uses a **differencing algorithm** to transmit only the changed parts between versions, minimizing bandwidth and storage.

**d. Message Queuing Service**

Handles asynchronous message-based communication:
- **Request Queue (global):** All client requests to update Metadata DB.
- **Response Queues (per client):** Deliver update messages to each subscribed client. Separate queues are needed per client since messages are deleted once received.

**e. Cloud/Block Storage**

Stores chunks of files. Clients interact directly with storage. Separating metadata from storage enables using any storage (cloud or on-premise).

### 7. File Processing Workflow

When Client A updates a file shared with Clients B and C:
1. Client A uploads chunks to cloud storage.
2. Client A updates metadata and commits changes.
3. Client A gets confirmation; notifications sent to Clients B and C.
4. Clients B and C receive metadata changes and download updated chunks.

### 8. Data Deduplication

Eliminate duplicate copies to improve storage utilization.

**a. Post-Process Deduplication:** Store chunks first, then analyze for duplicates. No performance degradation, but wastes storage and bandwidth temporarily.

**b. Inline Deduplication:** Calculate hash in real-time as clients enter data. If a chunk already exists, only a reference is added. Optimal network and storage usage.

### 9. Metadata Partitioning

1. **Vertical Partitioning:** Store tables for different features on different servers. Issue: scale problems within a table; joining tables across servers causes performance issues.

2. **Range-Based Partitioning:** Partition by first letter of file path. Issue: unbalanced servers.

3. **Hash-Based Partitioning:** Hash the FileID and map to a DB partition. Issue: overloaded partitions — solved with Consistent Hashing.

### 10. Caching

- **Block Storage Cache:** Memcached for hot chunks. LRU eviction policy.
- **Metadata DB Cache:** Separate cache layer.

### 11. Load Balancer

Place at two points:
1. Between Clients and Block servers.
2. Between Clients and Metadata servers.

Start with Round Robin; upgrade to intelligent LB that queries server load.

### 12. Security, Permissions, and File Sharing

Store permissions of each file in the Metadata DB. Control which files are visible or modifiable by each user.

---

## Designing Facebook Messenger

> **Difficulty Level:** Medium


### 1. What is Facebook Messenger?

Facebook Messenger provides text-based instant messaging. Users can chat with friends from cell phones and the Facebook website.

### 2. Requirements and Goals

**Functional Requirements:**
1. Support one-on-one conversations between users.
2. Track online/offline statuses of users.
3. Persistent storage of chat history.

**Non-Functional Requirements:**
1. Real-time chat experience with minimum latency.
2. Highly consistent — same chat history on all devices.
3. High availability desirable; lower availability acceptable in favor of consistency.

**Extended Requirements:**
- Group Chats.
- Push notifications for offline users.

### 3. Capacity Estimation and Constraints

- 500M daily active users; 40 messages/user/day → **20 billion messages/day**
- Average message size: 100 bytes
- Storage per day: `20B × 100 bytes = 2 TB/day`
- Storage for 5 years: `2 TB × 365 × 5 ≈ 3.6 PB`
- Bandwidth: `2 TB / 86400 ≈ 25 MB/s` incoming; 25 MB/s outgoing

| Metric | Estimate |
|--------|----------|
| Total messages | 20 billion/day |
| Storage per day | 2 TB |
| Storage for 5 years | 3.6 PB |
| Incoming data | 25 MB/s |
| Outgoing data | 25 MB/s |

### 4. High-Level Design

A **Chat Server** is the central orchestrator:
1. User-A sends a message to User-B through the chat server.
2. Server receives message and sends acknowledgment to User-A.
3. Server stores message in database and sends it to User-B.
4. User-B receives message and sends acknowledgment.
5. Server notifies User-A that message was delivered to User-B.

### 5. Detailed Component Design

**a. Messages Handling**

Two options for getting messages from the server:
1. **Pull model:** Users periodically ask for new messages. Problem: high latency, mostly empty responses.
2. **Push model (preferred):** All active users maintain an open connection; server pushes messages instantly.

**Open connection mechanisms:**
- **HTTP Long Polling:** Client requests; server holds request until new data is available, then responds. Client immediately re-issues request after receiving response.
- **WebSockets** (also viable).

**Server tracking connections:** Maintain a hash table: key = UserID, value = connection object. When a message arrives, look up the connection and send the message.

**Message ordering:** Store a sequence number with each message per client. Both clients see a different but internally consistent view.

**Number of chat servers needed:** 500M connections ÷ 50K connections/server = **10,000 servers**. A load balancer maps UserID to the correct server.

**b. Storing and Retrieving Messages**

Requirements:
- Very high rate of small updates (inserts).
- Fast range queries (sequential message fetching).

**Recommended storage: HBase** — a wide-column, column-oriented key-value NoSQL database:
- Groups data to store new data in a memory buffer; flushes to disk when full.
- Efficient for small updates and row/range scanning.
- Efficient for variable-sized data.

MySQL and MongoDB are not suitable due to high read/write latency for small frequent operations.

Clients should **paginate** when fetching data (fewer messages on mobile, more on desktop).

**c. Managing User's Status**

With 500M active users, broadcasting every status change is resource-intensive. Optimizations:
1. Client pulls status of all friends when the app starts.
2. Server sends failure notification when a message is sent to an offline user.
3. Server broadcasts "online" status with a small delay to confirm the user stays online.
4. Client pulls status for visible users only (viewport-based, not frequent).
5. Client pulls status when starting a new chat.

### 6. Data Partitioning

- **Partition based on UserID hash:** All messages of a user on the same shard.
- 3.6 PB ÷ 4 TB/shard = 900 shards → use 1,000 shards.
- Shard number: `hash(UserID) % 1000`
- Start with multiple logical partitions on fewer physical servers; add servers as needed.

Do NOT partition by MessageID — fetching a range of messages would be very slow.

### 7. Cache

Cache last 15 messages from the last 5 recent conversations visible in a user's viewport. Cache for a user should reside on one machine (same shard as user data).

### 8. Load Balancing

- Front of chat servers: Load balancer maps UserID to the server holding the user's connection.
- Front of cache servers.

### 9. Fault Tolerance and Replication

- **Chat server failure:** Clients automatically reconnect (TCP connection failover is complex).
- **Data replication:** Store multiple copies or use Reed-Solomon encoding.

### 10. Extended Requirements

**a. Group Chat**

- Separate group-chat objects identified by `GroupChatID`.
- Load balancer directs group chat messages based on GroupChatID.
- Server handling the group chat iterates through all members to find their servers.
- Group chats stored in a separate table partitioned by GroupChatID.

**b. Push Notifications**

- A Notification Server sends messages for offline users to the manufacturer's push notification server (APNs for iOS, FCM for Android).
- Devices receive notifications from the manufacturer's server.

---

## Designing Twitter

> **Difficulty Level:** Medium


### 1. What is Twitter?

Twitter is an online social networking service where users post and read short 140-character messages ("tweets"). Registered users can post and read; unregistered users can only read.

### 2. Requirements and Goals

**Functional Requirements:**
1. Users can post new tweets.
2. Users can follow other users.
3. Users can mark tweets as favorites.
4. The service creates and displays a user's timeline (top tweets from people they follow).
5. Tweets can contain photos and videos.

**Non-Functional Requirements:**
1. Highly available.
2. Acceptable latency of 200ms for timeline generation.
3. Consistency can take a hit (if a user doesn't see a tweet for a while, it's fine).

**Extended Requirements:** Searching tweets, replying to tweets, trending topics, tagging users, notifications, who-to-follow suggestions, Moments.

### 3. Capacity Estimation and Constraints

- 1 billion total users; 200M daily active users (DAU)
- 100M new tweets/day; average user follows 200 people
- Favorites per day: `200M × 5 favorites = 1B favorites/day`
- Tweet views per day: `200M × (2+5) × 20 tweets = 28B tweet-views/day`

**Storage estimates** (280 bytes per tweet + 30 bytes metadata):
- Text: `100M × 310 bytes = 30 GB/day`
- Media (1 in 5 photos at 200 KB, 1 in 10 videos at 2 MB): `24 TB/day`

**Bandwidth estimates:**
- Ingress: `24 TB / 86400 ≈ 290 MB/s`
- Egress: text `93 MB/s` + photos `13 GB/s` + videos `22 GB/s` ≈ **35 GB/s total**

### 4. System APIs

```
tweet(api_dev_key, tweet_data, tweet_location, user_location, media_ids, maximum_results_to_return)
```

Returns: URL to access the tweet on success; HTTP error otherwise.

### 5. High-Level System Design

- Write: `100M / 86400 ≈ 1,150 tweets/s`; peak: a few thousand/s
- Read: `28B / 86400 ≈ 325,000/s`; peak: ~1M read requests/s

**Read-heavy system.** Needs:
- Multiple application servers with load balancers.
- Efficient database for tweets.
- File storage for photos and videos.

### 6. Database Schema

- **Tweet:** TweetID, Content, TweetLocation, UserLatitude, UserLongitude, CreationDate, NumFavorites
- **User:** UserID, Name, Email, DateOfBirth, CreationDate, LastLogin
- **UserFollow:** UserID1, UserID2
- **Favorite:** UserID, TweetID, CreationDate

### 7. Data Sharding

**a. Sharding based on UserID:** All data for a user on one server. Issues: hot users, non-uniform distribution.

**b. Sharding based on TweetID:** Hash maps TweetID to a random server. Requires querying all servers for timeline generation. Good for eliminating hot-user problem.

**c. Sharding based on Tweet creation time:** Fast fetching of top tweets, but creates write hotspot (all new tweets go to one server).

**d. Combining TweetID and Tweet Creation Time (recommended):**
- Embed epoch time in TweetID: `TweetID = epoch_seconds (31 bits) + auto-increment (17 bits) = 48 bits`
- Every second can store `2^17 = 130K` new tweets.
- TweetID encodes timestamp; no separate secondary index needed.
- Use two DB servers (one even, one odd) for auto-increment keys.

Example TweetIDs:
```
1483228800 000001
1483228800 000002
```

Making TweetID 64-bit allows storing tweets for 100+ years with millisecond granularity.

### 8. Cache

- Use Memcache for hot tweets and users.
- **Eviction policy:** LRU.
- **80-20 rule:** Cache 20% of daily read volume from each shard.
- **Cache latest data:** Cache all tweets from past 3 days (≈ 100 GB) on dedicated cache servers — replicated to distribute read traffic.
- Cache structure: hash table where key = OwnerID, value = doubly linked list of recent tweets (head = newest, tail = oldest). Remove from tail to make space.

### 9. Replication and Fault Tolerance

- Multiple secondary DB servers per partition for read traffic.
- All writes go to primary → replicated to secondaries.
- If primary goes down, failover to a secondary.

### 10. Load Balancing

Place at three points:
1. Between Clients and Application servers.
2. Between Application servers and Database servers.
3. Between Aggregation servers and Cache servers.

Start with Round Robin; upgrade to intelligent LB.

### 11. Monitoring

Track:
- New tweets per day/second; daily peak.
- Timeline delivery stats.
- Average latency for timeline refresh.

### 12. Extended Requirements

- **Retweet:** Store the original TweetID in the retweet object; no content duplication.
- **Trending Topics:** Cache most frequent hashtags/search queries in last N seconds; update every M seconds. Rank by frequency, retweets, likes, and weight by reach.
- **Who to Follow:** Suggest friends of friends (2–3 levels deep); prioritize by follower count. Use ML to re-prioritize with signals like recent follower growth, common interests, location.
- **Moments:** Aggregate top news, find related tweets, categorize using ML (supervised learning/clustering).
- **Search:** See Designing Twitter Search.

---
## Designing YouTube / Netflix

> **Difficulty Level:** Medium | Similar Services: vimeo.com, dailymotion.com, veoh.com


### 1. Why YouTube?

YouTube is one of the most popular video sharing websites. Users upload, view, share, rate, report videos, and add comments.

### 2. Requirements and Goals

**Functional Requirements:**
1. Users can upload videos.
2. Users can share and view videos.
3. Users can search based on video titles.
4. Record video stats (likes/dislikes, total views).
5. Users can add and view comments.

**Non-Functional Requirements:**
1. Highly reliable — uploaded videos should never be lost.
2. Highly available; consistency can take a hit.
3. Real-time viewing experience with no lag.

*Not in scope:* Video recommendations, most popular videos, channels, subscriptions.

### 3. Capacity Estimation

- 1.5B total users; 800M daily active users.
- Average 5 videos/day/user: `800M × 5 / 86400 ≈ 46,000 video views/s`
- Upload:view ratio = 1:200 → `46K / 200 ≈ 230 videos uploaded/s`

**Storage estimates** (500 hours of video uploaded every minute; 50 MB per minute of video):
- `500 hours × 60 min × 50 MB = 1,500 GB/min (25 GB/s)`

**Bandwidth estimates** (10 MB/min per upload):
- Upload: `500 hours × 60 min × 10 MB = 300 GB/min (5 GB/s)`
- Download (1:200 ratio): `~1 TB/s`

### 4. System APIs

```
uploadVideo(api_dev_key, video_title, video_description, tags[], category_id,
            default_language, recording_details, video_contents)
```
Returns: HTTP 202 (accepted); user notified by email when encoding is complete.

```
searchVideo(api_dev_key, search_query, user_location, maximum_videos_to_return, page_token)
```
Returns: JSON list of video resources (title, thumbnail, creation date, view count).

```
streamVideo(api_dev_key, video_id, offset, codec, resolution)
```
- `offset`: time in seconds from beginning (enables resuming from any point on any device).
- `codec` and `resolution`: allow seamless device switching (e.g., TV to phone).
- Returns: media stream (video chunk) from the given offset.

### 5. High-Level Design

Core components:
1. **Processing Queue:** Each uploaded video is queued for encoding, thumbnail generation, and storage.
2. **Encoder:** Encodes uploaded videos into multiple formats.
3. **Thumbnails Generator:** Generates a few thumbnails per video.
4. **Video and Thumbnail Storage:** Distributed file storage.
5. **User Database:** MySQL for user information.
6. **Video Metadata Storage:** MySQL for title, file path, uploader, views, likes, comments.

### 6. Database Schema

**Video Metadata (MySQL):**
- VideoID, Title, Description, Size, Thumbnail, Uploader/UserID, Total Likes, Total Dislikes, Total Views

**Video Comments (MySQL):**
- CommentID, VideoID, UserID, Comment, TimeOfCreation

**User Data (MySQL):**
- UserID, Name, Email, Address, Age, RegistrationDetails

### 7. Detailed Component Design

The service is **read-heavy** with a 200:1 read/write ratio.

**Video Storage:** Distributed file systems like HDFS or GlusterFS.

**Managing Read Traffic:**
- Segregate read traffic from write traffic.
- Multiple copies of each video distributed across read servers.
- Metadata: master-slave configuration (writes to master, reads from slaves). Slight staleness is acceptable.

**Thumbnail Storage:**
- Thumbnails are small (max 5 KB) but read traffic is enormous (users see 20 thumbnails per page).
- Don't store on disk directly (too many seeks → high latency).
- Use **Bigtable:** combines multiple files into one block; efficient for small data reads.
- Cache hot thumbnails in memory.

**Video Uploads:** Support resumable uploads (connection may drop during large file uploads).

**Video Encoding:** After upload, a task is added to the processing queue. Once encoding is complete (multiple formats), the user is notified and the video is made available.

### 8. Metadata Sharding

**a. Sharding based on UserID:** All data for a user on one server. Issues: popular users create hotspots; non-uniform distribution.

**b. Sharding based on VideoID (preferred):** Hash maps VideoID to a random server. Eliminates hot-user problem. Querying all servers for a user's videos requires aggregation on a centralized server.

Introduce a cache in front of DB servers to store hot videos and reduce latency.

### 9. Video Deduplication

Duplicate videos (same content, different aspect ratios, encodings, or excerpts) waste storage, degrade cache efficiency, increase network usage, and cause energy waste.

**Inline deduplication (preferred over post-processing):** As soon as a user starts uploading, run video matching algorithms (Block Matching, Phase Correlation):
- If duplicate found: stop upload and use existing copy, or continue if new version is higher quality.
- If new video is a subpart of an existing one: intelligently divide and upload only missing parts.

### 10. Load Balancing

Use **Consistent Hashing** among cache servers to balance load. If a video becomes very popular (uneven load on its logical replica), use **dynamic HTTP redirections** to redirect the client to a less busy server in the same cache location.

Drawback of redirections: multiple redirections if the target server can't serve the video; additional HTTP requests add delay.

### 11. Cache

- Push content closer to users using geographically distributed video cache servers (CDN).
- Memcache for metadata server hot rows.
- **LRU eviction policy.**
- Cache 20% of daily read volume (80-20 rule).

### 12. Content Delivery Network (CDN)

Move popular videos to CDNs:
- CDNs replicate content in multiple places; videos are served closer to the user.
- CDN machines make heavy use of caching (mostly serve videos from memory).
- Less popular videos (1–20 views/day) served from data center servers directly.

### 13. Fault Tolerance

Use Consistent Hashing for distribution among database servers — helps replace dead servers and distribute load.

---

## Designing Typeahead Suggestion

> **Difficulty Level:** Medium | Similar Services: Auto-suggestions, Typeahead search


### 1. What is Typeahead Suggestion?

Typeahead suggestions enable users to search for known and frequently searched terms. As the user types in the search box, the system predicts the query and suggests completions. It's not about speeding up search but about guiding users to articulate better queries.

### 2. Requirements and Goals

**Functional Requirements:** Suggest top 10 terms starting with whatever the user has typed.

**Non-Functional Requirements:** Suggestions should appear in real-time (within 200ms).

### 3. Basic System Design and Algorithm

**Data Structure: Trie**

A trie (pronounced "try") is a tree-like data structure where each node stores a character of a phrase sequentially. Example trie for: `cap, cat, caption, captain, capital`:

```
         root
          |
          c
          |
          a
        /          p     t
      /    tion  ital
```

Nodes with only one branch can be merged to save storage space.

**Case sensitivity:** Use case-insensitive trie for simplicity.

**Finding top suggestions:**
- Store the count of searches that terminated at each node.
- Traverse the sub-tree under a prefix to find the top suggestions.
- Problem: traversing a huge sub-tree is slow (e.g., "system design interview questions" is 30 levels deep).

**Optimization — store top suggestions at each node:**
- Store the top 10 suggestions at each node to avoid traversal.
- Requires significant extra storage.
- Store only references (terminal node pointers) rather than full phrases to reduce storage.

### 4. Building and Updating the Trie

**Building:** Bottom-up construction — each parent node combines top suggestions from all children.

**Updating:**
- 5 billion searches/day → 60K queries/s → updating on every query is too expensive.
- **Offline updates:** Log every query (or sample every 1000th query). Use Map-Reduce jobs hourly to calculate frequencies of searched terms. Update the trie offline.

Two options for offline updates:
1. Make a copy of the trie on each server → update offline → switch to new trie.
2. **Master-slave configuration:** Update slave while master serves traffic → promote slave to master.

**Updating frequencies:** Use Exponential Moving Average (EMA) — give more weight to recent data; subtract old counts and add new counts. After inserting a new term, traverse from terminal node back to root, updating top 10 lists of parent nodes.

**Removing terms:** Add a filtering layer on each server to remove flagged terms (legal issues, hate speech, piracy) before sending to users. Fully remove from trie during next regular update.

**Ranking criteria:** Beyond simple count: freshness, user location, language, demographics, personal history.

### 5. Permanent Storage of the Trie

Store trie snapshots periodically for crash recovery:
- Save the trie level-by-level from the root.
- For each node: character it contains + number of children.
- Immediately after each node, store all its children.

Example: `C2,A2,R1,T,P,O1,D` — rebuilds into the same trie structure.

Top suggestions and counts are recalculated during rebuild (bottom-up, same as initial construction).

### 6. Scale Estimation

- 5 billion searches/day → 60K QPS.
- Unique terms: 20% of 5B queries → 1B; index top 50% → 100M unique terms.

**Storage estimates** (avg query = 3 words × 5 chars × 2 bytes = 30 bytes):
- `100M × 30 bytes = 3 GB` initially.
- With 2% new queries daily over 1 year: `3 GB + (0.02 × 3 GB × 365) ≈ 25 GB`

### 7. Data Partition

**a. Range-Based Partitioning:** By first letter. Problem: unbalanced servers.

**b. Partition by Maximum Server Capacity:** Fill each server to maximum memory capacity. Maintain a hash table mapping ranges to servers:
```
Server 1: A–AABC
Server 2: AABD–BXA
Server 3: BXB–CDA
```
Load balancer stores this mapping and redirects traffic. Aggregator servers merge results from multiple trie servers. Drawback: still creates hotspots (e.g., many queries for 'cap').

**c. Hash of the Term:** Map each term to a server by hashing. Minimizes hotspots but requires querying all servers for suggestions, then aggregating.

### 8. Cache

Cache the top searched terms on cache servers in front of trie servers. Use an ML model to predict engagement on suggestions (based on counting, personalization, trending data) and cache those terms.

### 9. Replication and Load Balancer

- Replicas for both load balancing and fault tolerance.
- Load balancer tracks data partitioning scheme and redirects based on prefixes.

### 10. Fault Tolerance

Master-slave configuration: if master dies, slave takes over. Servers rebuild the trie from the last snapshot on restart.

### 11. Typeahead Client Optimizations

1. Only hit the server if the user hasn't pressed a key for 50ms.
2. Cancel in-progress requests if the user keeps typing.
3. Wait until the user enters a couple of characters before the first request.
4. Pre-fetch some data from the server to save future requests.
5. Store recent search history locally (high reuse rate).
6. Open a server connection as soon as the user opens the search website (before any typing).
7. Push part of cache to CDNs and ISPs for efficiency.

### 12. Personalization

Store personal history per user on the server; cache on the client. Server adds personalized terms to the final suggestion set (always ranked before generic suggestions).

---

## Designing an API Rate Limiter

> **Difficulty Level:** Medium


### 1. What is a Rate Limiter?

A rate limiter limits the number of events an entity (user, device, IP, etc.) can perform in a particular time window, then blocks requests once the cap is reached.

Examples:
- A user can send only one message per second.
- A user is allowed only three failed credit card transactions per day.
- A single IP can only create twenty accounts per day.

### 2. Why Do We Need API Rate Limiting?

Rate limiting protects services against:
- **Denial-of-service (DoS) attacks** — barrage of HTTP/S requests that can bring down a service.
- **Brute-force attacks** — password attempts, credit card transactions.

Other benefits:
- **Misbehaving clients:** Prevent high-volume, low-priority requests from affecting critical traffic.
- **Security:** Limit second-factor authentication attempts.
- **Design discipline:** Prevent sloppy development (e.g., polling for the same data repeatedly).
- **Cost control:** Services are designed for normal input behavior; rate limiting prevents computational overload.
- **Revenue model:** Different rate limits for different service tiers.
- **Traffic spikiness:** Keep service up for all users during traffic spikes.

### 3. Requirements and Goals

**Functional Requirements:**
1. Limit the number of requests an entity can send to an API within a time window (e.g., 15 requests/s).
2. Rate limit should work across different servers in a cluster — users get errors when threshold is crossed across the cluster.

**Non-Functional Requirements:**
1. Highly available (the rate limiter protects the service from attacks).
2. Should not introduce substantial latency.

### 4. Types of Throttling

- **Hard Throttling:** Requests cannot exceed the throttle limit.
- **Soft Throttling:** API request limit can exceed by a set percentage (e.g., 10% above limit).
- **Elastic / Dynamic Throttling:** Requests can go beyond threshold if system resources are available.

### 5. Rate Limiting Algorithms

**a. Fixed Window Algorithm:**
Time window is from the start to end of the time unit (e.g., 0–60 seconds for a minute). The problem: a user can send requests at the end of one window and the start of the next, effectively doubling the allowed requests in a short span.

Example: With a 2-message/s limit, 3 messages in the last second of a minute + 3 messages in the first second of the next minute = 6 messages in 2 seconds.

**b. Rolling Window Algorithm (preferred):**
Time window is calculated from the time of the request plus the window length. More accurate but requires more storage to track individual request timestamps.

Example: With 2-message/s limit, if 2 messages are sent at 300ms and 400ms, the window is 300ms to 1300ms — any additional messages in this window are throttled.

### 6. High-Level Design

The Rate Limiter sits between the client and API servers:
1. New request arrives at Web Server.
2. Web Server asks Rate Limiter to decide: serve or throttle?
3. If not throttled: request passes to API servers.
4. If throttled: return HTTP 429 (Too Many Requests).

### 7. Basic System Design and Algorithm

For limiting requests per user, maintain a hash table:
- **Key:** UserID
- **Value:** `{ Count, StartTime }`

Algorithm for each new request:
1. If UserID not in hash table: insert, set Count = 1, StartTime = current time (normalized to minute), allow request.
2. If UserID found and `CurrentTime – StartTime >= 1 min`: reset StartTime, set Count = 1, allow request.
3. If `CurrentTime – StartTime < 1 min`:
   - If `Count < 3`: increment Count, allow request.
   - If `Count >= 3`: reject request.

**Problems with this approach:**
1. Fixed window issue: can allow 2× requests at window boundary.
2. **Atomicity:** In a distributed environment, concurrent "read-and-then-write" operations can create race conditions — two processes both see Count = 2 and both allow the request.

**Solutions to atomicity:**
- Use **Redis lock** for read-update operations (adds latency and complexity).
- Custom locking in a simple hash-table implementation.
- Use Redis sorted sets for the sliding window approach.

**Memory requirements:**
- UserID: 8 bytes; Count: 2 bytes; StartTime: 2 bytes; lock: 4 bytes = **16 bytes per user**
- Plus 20 bytes hash-table overhead → **36 bytes per user**
- For 1M users: `36 × 1M = 36 MB` — fits on a single server.

For 10M users at 10 requests/second = 10M QPS → too much for one server. Use Redis or Memcached in a distributed setup.

### 8. Sliding Window Algorithm

Track every request per user with timestamps in a Redis Sorted Set:
- **Key:** UserID
- **Value:** Sorted Set of Unix timestamps

Algorithm for each new request:
1. Remove all timestamps older than `CurrentTime - 1 minute`.
2. Count elements in sorted set. Reject if count ≥ rate limit.
3. Add current timestamp to sorted set.
4. Allow request.

**Sliding window with counters (more memory efficient):**
Keep a sorted hash (timestamp → count) to count requests per second:
1. Remove timestamps older than `CurrentTime - 1 minute`.
2. Sum all counts in the sorted hash.
3. Reject if total ≥ limit.
4. Increment count for current timestamp (or add new entry).

**Memory per user (sliding window with counters):**
`8 (UserID) + (4 (timestamp) + 2 (count) + 20 (Redis overhead)) × 60 + 20 (hash overhead) = 1.6 KB`

For 1M users: `1.6 KB × 1M = 1.6 GB` — manageable.

### 9. Distributed Rate Limiter

**Challenges:**
- **Inconsistency:** Each request may go to different rate limiter servers (sticky sessions violate load balancing).
- **Race conditions:** Same user's requests being processed concurrently.

**Solutions:**
- Use a centralized data store (Redis) that all rate limiter servers read from and write to.
- Set locks around read-update operations.
- Use **Lua scripts** in Redis for atomic operations.

### 10. How to Handle Users Exceeding the Rate Limit?

Return HTTP response code **429 (Too Many Requests)** with headers:
- `X-Ratelimit-Remaining`: remaining requests in the current window.
- `X-Ratelimit-Limit`: total requests allowed per window.
- `X-Ratelimit-Retry-After`: seconds to wait before making another request.

---
## Designing Twitter Search

> **Difficulty Level:** Hard

### 1. What is Twitter Search?

Twitter allows users to tweet short 140-character messages. Users search for tweets based on keywords. Twitter Search enables users to search all public tweets.

### 2. Requirements and Goals

- Efficient storage and querying of all tweet statuses.
- Users can search for any tweet, live, with low latency.

### 3. Capacity Estimation

- 1.5 billion total users; 800 million daily active users.
- 400 million tweets/day → 4,600 tweets/s.
- Average tweet size: 300 bytes.
- Storage per day: `400M × 300 bytes = 120 GB/day`
- For 5 years: `120 GB × 365 × 5 ≈ 200 TB`
- With 80% capacity model: `≈ 250 TB` needed. With fault-tolerance replication: **500 TB total**.
- At 4 TB per server: `500 TB / 4 TB = 125 servers` for 5 years.

### 4. System APIs

```
search(api_dev_key, search_terms, maximum_results_to_return, sort, page_token)
```

Parameters:
- `api_dev_key` (string): API developer key (used to throttle users).
- `search_terms` (string): A string containing the search terms.
- `maximum_results_to_return` (number): Number of tweets to return.
- `sort` (number): Optional sort mode — Latest first (0, default), Best matched (1), Most liked (2).
- `page_token` (string): Page in the result set to return.

Returns: JSON containing a list of tweets matching the search query (UserID, name, tweet text, TweetID, creation time, number of likes).

### 5. High-Level Design

Store all tweets in a database and build an index tracking which word appears in which tweet. This index enables quickly finding tweets that users search for.

### 6. Detailed Component Design

**1. Storage:**

- 5-year storage: 200 TB; with 80% capacity and replication: ~500 TB.
- Use MySQL with a table of (TweetID, TweetText), partitioned by TweetID.
- System-wide unique TweetIDs: for 5 years × 400M/day = 730B tweets → need 5-byte numbers.
- Hash TweetID to find storage server.

**2. Index:**

Build an inverted index: word → list of TweetIDs containing that word.

- Index size (500K English words + 200K nouns = 500K terms × 5 chars = 2.5 MB for words in memory).
- Index for last 2 years: 292B tweets × 5 bytes/TweetID = 1,460 GB.
- Assuming 15 indexable words per tweet: `(1460 GB × 15) + 2.5 MB ≈ 21 TB`.
- At 144 GB per server: `21 TB / 144 GB ≈ 152 servers` for the index.

**Sharding options for the index:**

- **Sharding based on Words:** Map each word to an index server. Issues: hot words create overloaded servers; non-uniform distribution is hard to maintain.
- **Sharding based on TweetID:** Map each Tweet to a server; index all words of that tweet there. Querying requires asking all servers, then aggregating results. A centralized aggregator merges results.

### 7. Fault Tolerance

- Each index server has a secondary replica.
- If both primary and secondary die: use a reverse index (IndexBuilder server) that maps index servers to TweetIDs they hold. Rebuild index by fetching the appropriate tweets.
- Keep a replica of the IndexBuilder server.

### 8. Cache

- Use Memcached in front of the database for hot tweets.
- LRU eviction policy.

### 9. Load Balancing

Place load balancers at two points:
1. Between Clients and Application servers.
2. Between Application servers and Backend (index) servers.

Start with Round Robin; upgrade to intelligent LB that queries server load.

### 10. Ranking

To rank by popularity (likes, comments, retweets):
- Store a "popularity number" with each index entry.
- Each partition sorts results by popularity before returning to the aggregator.
- Aggregator server combines all results, sorts by popularity, returns top results to user.

---

## Designing a Web Crawler

> **Difficulty Level:** Hard

### 1. What is a Web Crawler?

A web crawler (also known as spider, robot, worm, walker, or bot) is a software program that browses the World Wide Web in a methodical and automated manner. It collects documents by recursively fetching links from a set of starting pages.

**Uses of web crawlers:**
- Search engines use web crawling to index pages for faster search.
- Testing web pages and links for valid syntax and structure.
- Monitoring sites for structure or content changes.
- Maintaining mirror sites for popular websites.
- Searching for copyright infringements.
- Building special-purpose indexes (e.g., multimedia content).

### 2. Requirements and Goals

- **Scalability:** Can crawl the entire Web, fetching hundreds of millions of Web documents.
- **Extensibility:** Modular design so new document types and protocols can be added.

**Design considerations:**
- HTML only (but extensible to other media types).
- HTTP protocol (extensible to FTP and others).
- Target: crawl 15 billion web pages.
- Handle **Robots Exclusion Protocol** (robot.txt): fetch robot.txt before downloading content.

### 3. Capacity Estimation and Constraints

- Crawl 15 billion pages in 4 weeks: `15B / (4 × 7 × 86400) ≈ 6,200 pages/second`
- Average page size: 100 KB + 500 bytes metadata
- Total storage: `15B × (100 KB + 500 bytes) ≈ 1.5 PB`
- With 70% capacity model: `1.5 PB / 0.7 ≈ 2.14 PB`

### 4. High-Level Design

**Basic algorithm:**
1. Pick a URL from the unvisited URL list.
2. Determine the IP address of its hostname (DNS resolution).
3. Establish a connection to the host and download the document.
4. Parse the document to look for new URLs.
5. Add new URLs to the unvisited list.
6. Process the downloaded document (store/index it).
7. Go back to step 1.

**Crawling strategy:**
- **Breadth-First Search (BFS):** Most commonly used.
- **Depth-First Search (DFS):** Used when already connected to a website (saves handshaking overhead).
- **Path-ascending crawling:** Attempts to crawl every path in each URL (e.g., for `http://foo.com/a/b/page.html`, also crawl `/a/b/`, `/a/`, and `/`).

**Challenges:**
1. **Large volume:** Crawler can only download a fraction of web pages at any time → must prioritize intelligently.
2. **Rate of change:** Web pages change frequently → pages may change while being crawled.

### 5. Minimum Crawler Components

1. **URL Frontier:** Stores the list of URLs to download and prioritizes which URLs to crawl first.
2. **HTTP Fetcher:** Retrieves a web page from the server.
3. **Extractor:** Extracts links from HTML documents.
4. **Duplicate Eliminator:** Ensures same content isn't extracted twice.
5. **Datastore:** Stores retrieved pages, URLs, and metadata.

### 6. Detailed Component Design

**1. URL Frontier**

A FIFO queue for breadth-first traversal, distributed across multiple servers. Hash function maps each URL to a server responsible for crawling it.

**Politeness constraints:**
- Don't overload a server by downloading too many pages from it.
- Don't have multiple machines connecting to the same web server simultaneously.

**Implementation:** Each server has multiple FIFO sub-queues. Each worker thread has its own sub-queue. URL's canonical hostname determines which sub-queue it goes to (hash of hostname → thread number). This ensures at most one worker downloads from any given web server.

**Storage:** URL frontier can have hundreds of millions of URLs → store on disk. Use separate in-memory buffers for enqueuing (dump to disk when full) and dequeuing (fill from disk periodically).

**2. HTTP Fetcher Module**

Downloads documents using appropriate network protocol. Maintains a fixed-size cache of hostname → robots.txt exclusion rules to avoid re-downloading robot.txt on every request.

**3. Document Input Stream (DIS)**

Caches the entire downloaded document locally to allow multiple processing modules to re-read it:
- Documents ≤ 64 KB cached entirely in memory.
- Larger documents written to a backing file temporarily.

Each worker thread has an associated DIS that it reuses.

**4. Document Deduplication Test**

Prevent processing the same document multiple times (many pages are mirrored under different URLs):
- Calculate a 64-bit checksum (MD5/SHA) of each document.
- Store all checksums in a database.
- Compare new document's checksum against stored checksums.

**Checksum store size:** `15B documents × 8 bytes = 120 GB` — fits in a modern server's memory. If not enough memory: use an LRU cache backed by persistent storage.

**5. URL Filters**

Customizable mechanism to control which URLs are downloaded: blacklisting by domain, prefix, or protocol type.

**6. Domain Name Resolution**

DNS is a bottleneck with billions of URLs. Build a local DNS server to cache DNS results and reduce repeated requests.

**7. URL Deduplication Test**

Prevent downloading and processing the same URL multiple times:
- Store canonical checksums (4 bytes) of all seen URLs.
- Storage needed: `15B × 4 bytes = 60 GB`.
- Maintain an in-memory cache of popular URLs (high cache hit rate for popular links).
- **Bloom Filters:** Probabilistic data structure for set membership testing. Possible false positives (a URL may be incorrectly seen as visited and skipped), but no false negatives. Reduce false positives by increasing bit vector size.

**8. Checkpointing**

Web crawls take weeks. Write regular snapshots of crawler state to disk. Interrupted or aborted crawls can restart from the latest checkpoint.

### 7. Fault Tolerance

- Use **Consistent Hashing** for distribution among crawling servers — helps replace dead hosts and distribute load.
- All crawling servers perform regular checkpointing and store their FIFO queues to disk.
- If a server goes down: consistent hashing shifts load to other servers; new server picks up from snapshot.

### 8. Data Partitioning

Three kinds of data: URLs to visit, URL checksums for dedupe, document checksums for dedupe.

Since URLs are distributed based on hostnames, all three data types for a URL can be stored on the same host. Each host stores its set of URLs, URL checksums, and document checksums.

### 9. Crawler Traps

**Crawler traps** cause a crawler to crawl indefinitely:
- **Unintentional:** Symbolic links within a file system creating cycles.
- **Intentional:** Dynamically generated infinite webs of documents.

**Types of traps:** Anti-spam traps (catching spammer crawlers), traps designed to boost search ratings.

---

## Designing Facebook's Newsfeed

> **Difficulty Level:** Hard | Similar Services: Twitter Newsfeed, Instagram Newsfeed, Quora Newsfeed

### 1. What is Facebook's Newsfeed?

The Newsfeed is the constantly updating list of stories in the middle of Facebook's homepage. It includes status updates, photos, videos, links, app activity, and likes from people, pages, and groups that a user follows. Any social media site design (Twitter, Instagram, Facebook) will need a newsfeed system.

### 2. Requirements and Goals

**Functional Requirements:**
1. Newsfeed generated based on posts from people, pages, and groups a user follows.
2. A user may have many friends and follow many pages/groups.
3. Feeds may contain images, videos, or text.
4. Support appending new posts in real-time for all active users.

**Non-Functional Requirements:**
1. Generate any user's newsfeed in real-time — maximum latency: **2 seconds**.
2. A new post should appear in a user's feed within **5 seconds** of being posted.

### 3. Capacity Estimation

- Average user: 300 friends, follows 200 pages.
- 300M daily active users; 5 feed fetches/user/day → 1.5B newsfeed requests/day ≈ **17,500 requests/s**.
- Storage: 500 posts per user in memory × 1 KB/post = 500 KB/user.
- Total memory for active users: `300M × 500 KB = 150 TB`.
- At 100 GB per server: **1,500 machines** for top-500-posts-in-memory.

### 4. System APIs

```
getUserFeed(api_dev_key, user_id, since_id, count, max_id, exclude_replies)
```

Parameters:
- `user_id`: User for whom to generate the newsfeed.
- `since_id`: Returns results more recent than the specified ID.
- `count`: Number of feed items to retrieve (max 200 per request).
- `max_id`: Returns results older than or equal to the specified ID.
- `exclude_replies`: Exclude replies from timeline.

Returns: JSON object containing a list of feed items.

### 5. Database Design

Three primary objects: **User**, **Entity** (page, group), **FeedItem** (Post).

Relationships:
- A User can follow other Entities and become friends with other Users.
- Both Users and Entities can post FeedItems (text, images, videos).
- Each FeedItem has a UserID (creator).
- Each FeedItem may optionally have an EntityID (page or group where it was created).

Use separate tables for `UserFollow` (with a "Type" column to distinguish User vs. Entity) and `FeedMedia`.

### 6. High-Level Design

Two parts: **Feed Generation** and **Feed Publishing**.

**Feed Generation:**
1. Retrieve IDs of all users and entities that the user follows.
2. Retrieve latest, most popular and relevant posts for those IDs.
3. Rank posts by relevance.
4. Store the feed in the cache; return top 20 posts.
5. On front-end, fetch next 20 posts when the user reaches the end of their feed.
6. Periodically (every 5 minutes) regenerate and add newer posts.

**Feed Publishing:**
- When a user loads their newsfeed page, pull feed items from the server.
- When the user reaches the end of their feed, pull more data.
- Server can notify about newer posts (push) or user can pull manually.

**Components needed:**
1. **Web servers** — Maintain connection with users.
2. **Application servers** — Execute feed storage/retrieval workflows.
3. **Metadata database and cache** — Store metadata about Users, Pages, Groups.
4. **Posts database and cache** — Store post metadata and content.
5. **Video and photo storage and cache** — Blob storage for media.
6. **Newsfeed generation service** — Gather and rank posts; store in cache; handle live updates.
7. **Feed notification service** — Notify users of newer items.

### 7. Detailed Component Design

**a. Feed Generation Issues with Direct Queries**

```sql
(SELECT FeedItemID FROM FeedItem WHERE UserID in
   (SELECT EntityOrFriendID FROM UserFollow WHERE UserID = <id> AND type = 0))
UNION
(SELECT FeedItemID FROM FeedItem WHERE EntityID in
   (SELECT EntityOrFriendID FROM UserFollow WHERE UserID = <id> AND type = 1))
ORDER BY CreationDate DESC LIMIT 100
```

Issues:
1. Extremely slow for users with many friends/follows.
2. High latency when generated on page load.
3. Live updates cause high backlogs in the Newsfeed Generation Service.
4. Server push for celebrity users with millions of followers creates extremely heavy loads.

**Offline generation (preferred):**
- Dedicated servers continuously generate users' newsfeeds and store in memory.
- Hash table: key = UserID, value = `{ LinkedHashMap<FeedItemIDs>, DateTime lastGenerated }`.
- Use LinkedHashMap or TreeMap to allow jumping to any FeedItemID and iterate easily.
- Store **500 feed items per user** in memory (adjustable based on usage).
- Use an LRU-based cache to evict users who haven't accessed their feed recently.

**b. Feed Publishing**

The process of pushing a post to all followers is called **fanout**.

1. **Pull model (Fanout-on-load):** Users pull feed data on demand. Problems: stale data; most pulls result in empty responses.

2. **Push model (Fanout-on-write):** Once a user posts, immediately push to all followers via Long Poll. Problem: celebrity users with millions of followers create extreme server load.

3. **Hybrid (recommended):**
   - Push for users with few hundred/thousand followers.
   - Pull (or fanout-on-load) for celebrity users with millions of followers.
   - Limit fanout to online friends only for initial push.
   - Use "push to notify" + "pull for serving" combination.

**How many feed items per request?** Maximum limit (say 20 per request), but let client specify based on device type.

**Mobile devices:** Let users "Pull to Refresh" instead of pushing data (saves bandwidth).

### 8. Feed Ranking

Rank posts by selecting key signals:
- Number of likes, comments, shares.
- Time of update.
- Whether the post has images/videos.
- User relationship strength.

Combine signals into a final ranking score. Continuously improve by evaluating metrics like user stickiness, retention, and ad revenue.

### 9. Data Partitioning

**a. Sharding posts and metadata:** Same approach as Designing Twitter (shard by TweetID/PostID).

**b. Sharding feed data (in memory):**
- Partition by UserID: all of a user's feed data on one server.
- Hash function maps UserID to a cache server.
- Up to 500 FeedItemIDs per user will never exceed a single server's capacity.
- For future growth and replication: use Consistent Hashing.

---

## Designing Yelp / Proximity Server

> **Difficulty Level:** Hard | Similar Services: Proximity server, nearby friends

### 1. Why Yelp or Proximity Server?

Proximity servers are used to discover nearby attractions like places and events. Our service stores information about different places so users can perform searches and get a list of places around them.

### 2. Requirements and Goals

**Functional Requirements:**
1. Users can add/delete/update Places.
2. Given their location (longitude/latitude), users can find all nearby places within a given radius.
3. Users can add feedback/reviews about a place (pictures, text, rating).

**Non-Functional Requirements:**
1. Real-time search experience with minimum latency.
2. Heavy search load (far more searches than new place additions).

### 3. Scale Estimation

- 500M places; 100K QPS.
- 20% growth in places and QPS each year.

### 4. Database Schema

**Place:**
- LocationID (8 bytes), Name (256 bytes), Latitude (8 bytes), Longitude (8 bytes), Description (512 bytes), Category (1 byte)
- Total: ~793 bytes per place

**Review:**
- LocationID (8 bytes), ReviewID (4 bytes), ReviewText (512 bytes), Rating (1 byte)

Also separate tables for photos (linked to Places and Reviews).

### 5. System APIs

```
search(api_dev_key, search_terms, user_location, radius_filter,
       maximum_results_to_return, category_filter, sort, page_token)
```

Returns: JSON list of businesses (name, address, category, rating, thumbnail).

`sort` options: Best matched (0, default), Minimum distance (1), Highest rated (2).

### 6. Basic System Design and Algorithm

**a. SQL Solution**

Store places in MySQL with latitude and longitude columns (indexed). Query:
```sql
SELECT * FROM Places
WHERE Latitude BETWEEN X-D AND X+D
AND Longitude BETWEEN Y-D AND Y+D
```

Issue: With 500M places and two separate indexes, each returns a huge list → intersection is inefficient.

**b. Grids**

Divide the map into smaller grids; each grid stores all Places within a specific lat/long range. Query only neighboring grids.

Query:
```sql
SELECT * FROM Places
WHERE Latitude BETWEEN X-D AND X+D
AND Longitude BETWEEN Y-D AND Y+D
AND GridID IN (GridID, GridID1, ..., GridID8)
```

**In-memory index:** Hash table where key = GridID, value = list of Places.

Memory estimate (search radius = 10 miles):
- Earth area = 200M sq miles → 20M grids
- `(4 × 20M) + (8 × 500M) ≈ 4 GB` — manageable.

Problem: Places aren't uniformly distributed → some grids have many places, others have few.

**c. Dynamic Size Grids — QuadTree (recommended)**

Don't have more than 500 places per grid. When a grid exceeds this limit, split it into four equal sub-grids.

**QuadTree:** A tree where each node has four children. Each node represents a grid and contains all Places in that grid. When a node reaches 500 places, it splits into four child nodes.

**Building the QuadTree:** Start with one node (whole world) → split until all leaf nodes have ≤ 500 places.

**Finding the grid for a location:** Traverse from root, moving to the child node containing the desired location at each step.

**Finding neighboring grids:** Connect all leaf nodes with a **doubly linked list** for iterating between neighbors. Also keep parent pointers to find siblings by going up the tree.

**Search workflow:**
1. Find the node containing the user's location.
2. If enough places found, return them.
3. Otherwise, expand to neighboring nodes until enough places found or search radius exhausted.

**QuadTree memory requirements:**
- Location data: `24 bytes × 500M = 12 GB`
- Grids: `500M / 500 = 1M leaf nodes`
- Internal nodes: `1M × (1/3) × 4 pointers × 8 bytes = 10 MB`
- **Total: ~12.01 GB** — fits on a single modern server.

### 7. Data Partitioning

**a. Sharding based on regions (zip codes):** All places in a region on one server. Issues: hot regions; non-uniform distribution.

**b. Sharding based on LocationID (preferred):** Hash maps LocationID to a server. All servers search their local QuadTree; a centralized server aggregates results. Different servers may have different QuadTree structures (fine — we search all neighboring grids on all partitions).

### 8. Replication and Fault Tolerance

- Master-slave configuration: slaves serve read traffic; all writes go to master → applied to slaves.
- Slaves may be a few milliseconds behind (acceptable).
- If primary QuadTree server dies: secondary replica takes over.
- If both die: rebuild from a reverse index. **QuadTree Index Server** holds a HashMap: key = QuadTree server number, value = HashSet of LocationIDs on that server. Rebuild by fetching those locations. Keep replica of QuadTree Index Server.

### 9. Cache

Use Memcached for hot Places. LRU eviction policy.

### 10. Load Balancing

Place LBs at two points:
1. Between Clients and Application servers.
2. Between Application servers and Backend servers.

Start with Round Robin; upgrade to intelligent LB.

### 11. Ranking

To rank by proximity AND popularity:
- Track overall popularity (e.g., average star rating out of 10) in DB and QuadTree.
- Each QuadTree partition returns top 100 places with maximum popularity.
- Aggregator server determines top 100 overall.
- Update popularity once or twice a day (during low load), since popularity changes slowly.

---

## Designing an Online Movie Ticket Booking System

> **Difficulty Level:** Hard | Similar Services: bookmyshow.com, ticketmaster.com

### 1. What is an Online Movie Ticket Booking System?

A movie ticket booking system provides customers the ability to purchase theater seats online. Customers browse movies currently being played and book seats anywhere, anytime.

### 2. Requirements and Goals

**Functional Requirements:**
1. List different cities where affiliate cinemas are located.
2. Given a city, display movies currently released there.
3. Given a movie, display cinemas running it and available show times.
4. Users can choose a show at a cinema and book tickets.
5. Show the seating arrangement of the cinema hall; users select multiple seats.
6. Distinguish available seats from booked ones.
7. Users can put a **hold on seats for 5 minutes** before payment.
8. Users can wait if seats might become available (holds expiring).
9. Waiting customers serviced in **first-come, first-serve** order.

**Non-Functional Requirements:**
1. Highly concurrent — multiple simultaneous booking requests for the same seat.
2. Financial transactions — must be secure and the database **ACID compliant**.

### 3. Design Considerations

1. No user authentication required (for simplicity).
2. No partial ticket orders — all or nothing.
3. Fairness is mandatory.
4. Restrict users to maximum 10 seats per booking to prevent abuse.
5. System must be scalable and highly available for popular movie releases.

### 4. Capacity Estimation

- 3 billion page views/month; 10 million tickets sold/month.
- 500 cities × 10 cinemas × 2,000 seats × 2 shows/day × 100 bytes/show = **2 GB/day**.
- 5-year storage: `2 GB × 365 × 5 ≈ 3.6 TB`.

### 5. System APIs

```
SearchMovies(api_dev_key, keyword, city, lat_long, radius, start_datetime,
             end_datetime, postal_code, includeSpellcheck,
             results_per_page, sorting_order)
```
Returns: JSON list of movies and their shows (title, description, duration, genre, start/end time, seat types and availability).

```
ReserveSeats(api_dev_key, session_id, movie_id, show_id, seats_to_reserve[])
```
Returns: Reservation status: "Reservation Successful", "Reservation Failed - Show Full", or "Reservation Failed - Retry".

### 6. Database Design

**Tables:** Movie, Show, Booking, User, Cinema, Cinema_Hall, Show_Seat, Payment, City, Cinema_Seat.

Key relationships:
- Each City → multiple Cinemas.
- Each Cinema → multiple Cinema Halls.
- Each Movie → many Shows; each Show → multiple Bookings.
- A User → multiple Bookings.

Show_Seat tracks individual seat status (available, reserved, booked) and price.

### 7. High-Level Design

Web servers manage user sessions. Application servers handle all ticket management — storing data in databases and working with cache servers to process reservations.

### 8. Detailed Component Design

**Ticket Booking Workflow:**
1. User searches for a movie → selects a movie.
2. User is shown available shows → selects a show.
3. User selects number of seats → shown theater map if seats available.
4. User selects seats → system tries to reserve them.
5. If reservation fails (show full, seats unavailable): display error or waiting page.
6. If seats reserved: user has **5 minutes to pay**. On payment: booking marked complete. On timeout: seats released back to available.

**Two daemon services:**

**a. ActiveReservationsService**

Tracks all active (not yet completed/expired) reservations:
- In-memory Linked HashMap per show (key = BookingID, value = creation Timestamp).
- Head always points to oldest reservation → expired when timeout reached.
- Also stored in the `Booking` table (Status = "Reserved (1)").
- Completes: Status updated to "Booked (2)", removed from Linked HashMap.
- Expired: marked "Expired (3)" or removed from Booking table.
- Works with external financial service for payment processing.
- Notifies WaitingUsersService when reservation is completed or expired.

HashTable structure: key = ShowID, value = LinkedHashMap of `<BookingID, Timestamp>`.

**b. WaitingUsersService**

Tracks all waiting users for each show:
- In-memory Linked HashMap per show (key = UserID, value = wait-start-time).
- Head always points to longest waiting user (first-come-first-served).
- HashTable: key = ShowID, value = LinkedHashMap of `<UserID, wait-start-time>`.
- Clients use **Long Polling** to get updates on reservation status.

**Reservation Expiration:** Server-side buffer of 5 seconds added to prevent client timeouts occurring after the server — ensuring no successful purchase window is missed.

### 9. Concurrency

Prevent two users from booking the same seat using **SQL transactions with Serializable isolation level**:

```sql
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRANSACTION;

-- Reserve seats 54, 55, 56 for ShowID=99
SELECT * FROM Show_Seat
WHERE ShowID=99 AND ShowSeatID IN (54, 55, 56) AND Status=0; -- free

-- If 3 rows returned, proceed with reservation:
UPDATE Show_Seat ...
UPDATE Booking ...

COMMIT TRANSACTION;
```

`SERIALIZABLE` isolation guarantees safety from Dirty Reads, Nonrepeatable Reads, and Phantom Reads. Rows are write-locked during the transaction.

### 10. Fault Tolerance

- **ActiveReservationsService crash:** Rebuild from `Booking` table (Status = "Reserved"). Or use master-slave setup.
- **WaitingUsersService crash:** No recovery unless master-slave setup (data not persisted to DB).
- **Database:** Master-slave setup for fault tolerance.

### 11. Data Partitioning

- **Database partitioning by ShowID:** Load distributed across servers (better than MovieID, which concentrates popular movie load).
- **ActiveReservationService and WaitingUserService:** Use Consistent Hashing based on ShowID. Each show handled by a set of servers (e.g., 3 servers per show via Consistent Hashing).

**When a reservation expires:**
1. Update database (remove/expire Booking; update Show_Seat status).
2. Remove from Linked HashMap.
3. Notify user that reservation expired.
4. Broadcast to all WaitingUserService servers for that Show to find the longest-waiting user.
5. Notify longest-waiting user's WaitingUserService server to process their request if seats are available.

**When a reservation succeeds:**
1. Notify all WaitingUserService servers for that Show.
2. Servers query DB (using cache) for current free seat count.
3. Expire all waiting users who want more seats than currently available.

---

## System Design Basics

> Foundational concepts for designing scalable distributed systems.

### Key Characteristics of Distributed Systems

**Scalability** is the capability of a system to grow and manage increased demand (data volume, transactions, users). A scalable system achieves this without performance loss.

**Horizontal vs. Vertical Scaling:**
- **Horizontal Scaling (Scale Out):** Add more servers to the pool. Easier to scale dynamically. Examples: Cassandra, MongoDB.
- **Vertical Scaling (Scale Up):** Add more power (CPU, RAM, Storage) to an existing server. Limited to single server capacity; scaling often requires downtime. Example: MySQL.

**Reliability** is the probability a system will fail in a given period. A reliable distributed system keeps delivering services even when software or hardware components fail. Achieved through redundancy of software components and data.

**Availability** is the percentage of time a system remains operational under normal conditions. High reliability contributes to high availability, but high availability can be achieved even with unreliable hardware by minimizing repair time.

**Efficiency** is measured by response time (latency) and throughput (bandwidth).

**Serviceability / Manageability** is how easily a system can be operated and maintained. Early fault detection reduces downtime.

---

### Scalability

Key principles for designing scalable systems:
- Avoid single points of failure.
- Distribute load evenly across participating nodes.
- Design for horizontal scaling from the start.

A system may degrade with size due to network latency, non-distributable tasks, or management overhead. A scalable architecture actively avoids these by balancing load on all nodes.

---

### Load Balancing

A **Load Balancer (LB)** sits between the client and server, distributing incoming traffic across multiple backend servers to improve responsiveness and availability.

**Benefits:**
- Faster, uninterrupted service for users.
- Less downtime and higher throughput for service providers.
- Easier request management for system administrators.
- Smart LBs provide predictive analytics for traffic bottlenecks.
- Fewer failed or stressed components.

**Placement in system:**
- Between the user and web servers.
- Between web servers and application/cache servers.
- Between internal platform layer and databases.

**Health Checks:** LBs regularly attempt to connect to backend servers. Unhealthy servers are automatically removed from the pool.

**Load Balancing Algorithms:**
- **Least Connection:** Directs traffic to the server with the fewest active connections.
- **Least Response Time:** Directs to the server with fewest connections and lowest average response time.
- **Least Bandwidth:** Selects the server currently serving the least traffic (in Mbps).
- **Round Robin:** Cycles through servers sequentially; best for servers of equal specification.
- **Weighted Round Robin:** Assigns weights to servers based on processing capacity; higher-weight servers get more connections.
- **IP Hash:** Calculates hash of client IP to always redirect the same client to the same server.

**Redundant Load Balancers:** A second LB can be connected to the first. Each monitors the other's health. If the active LB fails, the passive LB takes over.

---

### Caching

Caches take advantage of the **locality of reference principle**: recently requested data is likely to be requested again. They exist at all levels: hardware, OS, web browsers, web applications.

**Application Server Cache:** Each request layer node caches response data locally. Cache miss → query from disk/database.

**Distributed Cache:** In multi-node setups, if load balancer randomly distributes requests, the same request may go to different nodes → cache misses. Solutions: Global Cache (all nodes use one large shared cache) or Distributed Cache (each node holds a portion of the cached data; use consistent hashing).

**Content Distribution Network (CDN):**
- For sites serving large amounts of static media.
- CDN serves content if available locally; otherwise queries back-end servers, caches locally, and serves to user.
- Move popular videos/images/static files to CDNs for geographic proximity.

**Cache Invalidation:**
Three schemes to keep cache consistent with the database:
- **Write-through cache:** Write to cache AND database simultaneously. No data loss risk, but higher write latency.
- **Write-around cache:** Write directly to permanent storage, bypassing cache. Recent data causes cache misses; higher read latency for recently written data.
- **Write-back cache:** Write to cache only; write to permanent storage later (asynchronously). Low write latency; risk of data loss if cache goes down.

**Cache Eviction Policies:**
- **FIFO (First In First Out):** Evict the first item added, regardless of access frequency.
- **LIFO (Last In First Out):** Evict the most recently added item.
- **LRU (Least Recently Used):** Evict the item not used for the longest time. Most commonly used.
- **MRU (Most Recently Used):** Evict the most recently used item.
- **LFU (Least Frequently Used):** Evict the item accessed the least number of times.
- **RR (Random Replacement):** Randomly select an item to evict.

---

### Sharding / Data Partitioning

**Data partitioning (sharding)** breaks a large database into smaller parts distributed across multiple machines to improve manageability, performance, availability, and load balancing.

**Partitioning Methods:**

**a. Horizontal Partitioning (Range-Based Sharding):**
Different rows into different tables based on a value range (e.g., ZIP codes less than 10000 in one table, greater in another). Problem: if the range value isn't chosen carefully, leads to unbalanced servers.

**b. Vertical Partitioning:**
Divide data to store tables related to a specific feature on one server (e.g., user-related tables on one server, file-related tables on another). Problem: if one table grows huge, further partitioning within that table becomes necessary.

**c. Directory-Based Partitioning:**
A loosely coupled approach using a lookup service to know the partitioning scheme. Allows adding DB servers or changing the partitioning scheme without impacting the application.

**Partitioning Criteria:**

**Hash-Based Partitioning:** Apply a hash function to a key attribute; use the hash result to determine the partition. Distributes data uniformly. Problem: adding/removing servers requires re-hashing → solved with Consistent Hashing.

**List Partitioning:** Each partition is assigned a list of values. When inserting a new record, determine which partition has the value's list.

**Round-Robin Partitioning:** With n partitions, assign the i-th row to partition `i % n`. Ensures uniform distribution.

**Composite Partitioning:** Combine multiple partitioning schemes. First apply list partitioning, then hash partitioning.

**Common Problems with Sharding:**

- **Joins and Denormalization:** Joins across multiple database servers are inefficient; denormalize to perform joins in application code.
- **Referential Integrity:** Enforcing foreign keys in a distributed system is difficult; move referential integrity enforcement to the application.
- **Rebalancing:** As data grows unevenly, partitions need rebalancing. Use directory-based partitioning or Consistent Hashing to minimize this.

---

### Indexes

An index is a data structure (like a table of contents) that points to the location of actual data, enabling fast retrieval.

**How indexes work:** Create an index on a column → store that column + pointer to the full row in the index. Queries on that column can look up the index instead of scanning the full table.

**Benefits of indexes:**
- Dramatically speed up data retrieval.
- Essential for large datasets (many terabytes) with small payloads.
- Enable fast location of data spread across multiple physical devices.

**Trade-offs:**
- Indexes can be large (additional keys), slowing down data insertion and updates.
- When adding rows or updating existing rows, all indexes on that table must be updated.
- For write-heavy databases, too many indexes can degrade write performance significantly.

**Best practice:** Carefully consider how users will access data before creating indexes. Add indexes for the most frequently queried columns.

---

### Proxies

A **proxy server** is an intermediate piece of software or hardware that handles requests from clients, taking action on behalf of the client.

**Types of Proxies:**

**Forward Proxy:** Hides the identity of the client. Client sends request to proxy → proxy forwards to server. Used for caching, filtering, logging, and transforming requests.

**Reverse Proxy:** Retrieves resources on behalf of a client from one or more servers. Resources are returned to the client as if they originated from the proxy itself. Used for load balancing, SSL termination, caching.

**Proxy server main benefit:** Ability to cache websites. Cached responses can be served directly to clients without hitting the back-end server.

---

### Redundancy and Replication

**Redundancy** is the duplication of critical components to increase reliability:
- Provides backup or fail-safe functionality.
- Removes single points of failure.
- If two instances of a service run and one fails, the system fails over to the other.

**Replication** means sharing information to ensure consistency between redundant resources:
- Improves reliability, fault-tolerance, and accessibility.
- Widely used in database management systems (DBMS).
- **Master-slave relationship:** The master gets all updates → updates ripple to slaves. Each slave confirms it received the update.
- Benefits: automatic failover, read load distribution, backup.

---

### SQL vs. NoSQL

**SQL (Relational) Databases:**
- Store data in tables (rows and columns).
- Fixed schema — all records conform to the schema.
- Support ACID properties (Atomicity, Consistency, Isolation, Durability).
- Use structured query language (SQL) for data manipulation.
- Scale vertically (usually).
- Examples: MySQL, PostgreSQL, Oracle, SQLite.

**NoSQL (Non-Relational) Databases:**
- Store data in different models: key-value, document, graph, column-family.
- Dynamic schema — no need to define schema upfront; columns can vary per row.
- Generally sacrifice some ACID properties for scalability and performance.
- Scale horizontally.
- Examples: MongoDB (document), Cassandra (column-family), Redis (key-value), Neo4J (graph).

**Types of NoSQL Databases:**
- **Key-Value Stores:** Data stored as key-value pairs. Fast lookups. Examples: Redis, Dynamo.
- **Document Databases:** Data stored in documents (JSON/BSON). Each document can have different structure. Examples: MongoDB, CouchDB.
- **Wide-Column Databases:** Column families as containers for rows. No need to know all columns upfront; different rows can have different columns. Best for large datasets analytics. Examples: Cassandra, HBase.
- **Graph Databases:** Data stored as nodes (entities), properties, and edges (connections). Best for highly interconnected data. Examples: Neo4J, InfiniteGraph.

**High-Level Differences:**
- **Storage:** SQL uses tables; NoSQL uses key-value, document, graph, or columnar.
- **Schema:** SQL has fixed schema; NoSQL has dynamic schema.
- **Querying:** SQL uses standardized SQL; NoSQL uses UnQL (Unstructured Query Language), varies by database.
- **Scalability:** SQL scales vertically; NoSQL scales horizontally.
- **Reliability/ACID:** SQL databases support ACID transactions; most NoSQL databases sacrifice ACID for performance.

**When to Use SQL:**
- Need ACID compliance (e.g., financial transactions, e-commerce).
- Data is structured and unchanging.
- Queries are complex (many joins, aggregations).
- Examples: legacy systems, banking, inventory management.

**When to Use NoSQL:**
- Need to store large volumes of data with no clear structure.
- Making the most of cloud computing and storage (horizontal scaling).
- Rapid development with frequently changing schema.
- Need massive scale and high availability (e.g., social networks, real-time analytics).
- Examples: content management, user profiles, real-time big data.

---

### CAP Theorem

The **CAP Theorem** states that a distributed system can only guarantee **two** of the following three properties simultaneously:

1. **Consistency (C):** All nodes see the same data at the same time. Achieved by updating several nodes before allowing further reads.

2. **Availability (A):** Every request gets a response (success or failure). Achieved by replicating data across different servers.

3. **Partition Tolerance (P):** The system continues to work despite network message loss or partial failure. Data is sufficiently replicated across nodes and networks to keep the system up through intermittent outages.

**Why can't we have all three?**
- To be consistent, all nodes must see the same updates in the same order.
- If the network suffers a partition, updates in one partition might not reach other partitions before a client reads from the out-of-date partition.
- The only way to cope is to stop serving requests from the out-of-date partition — but then the system is no longer available.

**Common combinations:**
- **CA (Consistency + Availability):** Works on a single server or non-partitioned systems. Example: traditional RDBMS.
- **CP (Consistency + Partition Tolerance):** Sacrifices availability. System waits for consistency before responding. Example: HBase, MongoDB.
- **AP (Availability + Partition Tolerance):** Sacrifices consistency (eventual consistency). System always responds, but might return stale data. Example: Cassandra, DynamoDB.

Since network partitions are inevitable in distributed systems, trading off between consistency and availability is the primary design decision.

---

### Consistent Hashing

**The Problem:** When using a simple modular hash function (`server = hash(key) % N`), adding or removing a server requires remapping almost all keys → massive data migration.

**Consistent Hashing** minimizes reorganization when nodes are added or removed. Only `k/n` keys need to be remapped (where `k` = total keys, `n` = total servers).

**How It Works:**

1. Hash server addresses (or IPs) to integers in the range [0, 256) and place them on a **ring** (values wrap around).
2. To map a key to a server:
   - Hash the key to a single integer.
   - Move **clockwise** on the ring until a server is found.
   - That server is responsible for the key.

3. When a server is added: it takes a share of keys from the next server on the ring.
4. When a server is removed: its keys are distributed to the next server on the ring.

**Virtual Nodes:** To ensure more uniform distribution, each physical server is represented by multiple virtual nodes on the ring. This ensures each server handles roughly an equal number of keys and reduces hotspots.

**Use cases:** Distributed caching (Memcached, Redis clusters), distributed databases (Cassandra), load balancing.

---

### Long-Polling vs. WebSockets vs. Server-Sent Events

Three popular communication protocols for pushing data from server to client:

**Standard HTTP Request:**
1. Client opens connection and requests data.
2. Server calculates the response.
3. Server sends response on the opened request.

**Ajax Polling:**
- Client repeatedly polls the server at regular intervals (e.g., every 0.5 seconds).
- Server responds immediately (with data or empty response).
- Problem: Most responses are empty → HTTP overhead. Not real-time.

**HTTP Long-Polling:**
- Client requests data; server holds the request open until data is available or a timeout occurs.
- Once data is available: server sends full response → client immediately re-issues a new request.
- Lifecycle:
  1. Client makes initial request using regular HTTP and waits.
  2. Server delays response until update is available or timeout.
  3. When update is available: server sends full response.
  4. Client sends new long-poll request immediately (or after a brief pause).
  5. Each long-poll request has a timeout; client must reconnect periodically.
- Problem: Timeouts require reconnection; messages may arrive out of order.

**WebSockets:**
- Provides **full-duplex (bidirectional) communication** over a single TCP connection.
- **Persistent connection** — both client and server can send data at any time.
- **WebSocket handshake:** Client sends an HTTP upgrade request; server agrees → connection upgraded to WebSocket.
- Lower overhead than HTTP (no headers on each message).
- Enables **real-time** data transfer in both directions.
- Best for: chat applications, gaming, real-time collaboration, live dashboards.

**Server-Sent Events (SSEs):**
- Client establishes a **persistent, long-term connection** with the server.
- Server uses this connection to push data **one-way** (server to client only).
- Client cannot send data to server through SSE (requires a separate protocol for that).
- Lifecycle:
  1. Client requests data using regular HTTP.
  2. Requested page opens a connection to the server.
  3. Server sends data to client whenever new information is available.
- Best for: real-time traffic from server to client only; server generating data in a loop (e.g., stock price updates, news feeds, live sports scores).

**Comparison:**

| Feature | Ajax Polling | Long-Polling | WebSockets | SSE |
|---------|-------------|--------------|------------|-----|
| Direction | Client → Server | Client → Server | Bidirectional | Server → Client |
| Real-time | No | Near real-time | Yes | Yes |
| Connection | New per request | Held open | Persistent | Persistent |
| Overhead | High | Medium | Low | Low |
| Use case | Simple polling | Chat, notifications | Chat, gaming | News feeds, dashboards |

---

## Additional Resources

For further reading on system design fundamentals:

1. **Dynamo** — Highly Available Key-value Store (Amazon)
2. **Kafka** — A Distributed Messaging System for Log Processing
3. **Consistent Hashing** — Original paper
4. **Paxos** — Protocol for distributed consensus
5. **Concurrency Controls** — Optimistic methods for concurrency controls
6. **Gossip Protocol** — For failure detection and more
7. **Chubby** — Lock service for loosely-coupled distributed systems
8. **ZooKeeper** — Wait-free coordination for Internet-scale systems
9. **MapReduce** — Simplified Data Processing on Large Clusters
10. **Hadoop** — A Distributed File System

---

*This document is based on the "Grok System Design Interview" guide — a comprehensive resource covering system design interview preparation, real-world system design case studies, and foundational distributed systems concepts.*
