# Connect Sphere User Stories
---
## 1. Account & Login
### Front of Card
> As a general user, I want to create an account using email or login using username so that I can access the platform and start sharing content.
### Back of Card
**Success Scenario:**
* User registers with email or username.
* Unique username/email is validated.
* System sends verification email.
* User sets a secure password.
* User logs in and logs out securely.
**Failure Scenarios:**
* **Duplicate account:** `This email/username is already taken.`
* **Weak password:** `Password must meet security requirements.`
* **Email not verified:** `Please confirm your email to continue.`
* **Server error:** `Unable to process registration. Try again later.`
---
## 2. View Feed
### Front of Card
> As a content consumer, I want to scroll through a feed of posts so that I can see updates from people I follow.
### Back of Card
**Success Scenario:**
* Feed displays posts from followed users.
* Newest posts appear at the top.
* Posts load with full content (images, text, likes, comments).
**Failure Scenarios:**
* **Empty feed:** `Your feed is empty. Follow users to see posts.`
* **Network error:** `Unable to load feed. Check your connection.`
* **Server issue:** `Something went wrong. Please refresh.`
---
## 3. Create Post
### Front of Card
> As a user, I want to upload photos, videos, or text so that I can share content with my followers.
### Back of Card
**Success Scenario:**
* User selects and uploads text, image, or video.
* Captions and tags can be added.
* Post appears in feed after publishing.
**Failure Scenarios:**
* **Invalid format/size:** `Unsupported file type or file too large.`
* **Server error:** `Upload failed. Please try again later.`
* **Unauthorized:** `Please log in to create a post.`
---
## 4. Like Post
### Front of Card
> As a user, I want to like posts so that I can show appreciation for content I enjoy.
### Back of Card
**Success Scenario:**
* User taps like/unlike.
* Like count updates instantly.
* System prevents duplicate likes.
**Failure Scenarios:**
* **Unauthorized:** `Login required to like posts.`
---
## 5. Comment on Post
### Front of Card
> As a user, I want to leave comments so that I can share my thoughts and interact with others.
### Back of Card
**Success Scenario:**
* User submits comment.
* Comment appears under post.
* Comment count updates.
* User can edit/delete own comments.
**Failure Scenarios:**
* **Empty input:** `Comment cannot be blank.`
* **Unauthorized:** `Please log in to comment.`
---
## 6. Share/Repost
### Front of Card
> As a user, I want to share or repost content so that others in my network can also see it.
### Back of Card
**Success Scenario:**
* User selects share/repost option.
* Original creator attribution is displayed.
* Shared post appears in followers’ feed.
**Failure Scenarios:**
* **Unauthorized:** `You must log in to share posts.`
---
## 7. Direct Messaging
### Front of Card
> As a user, I want to send and receive private messages so that I can communicate directly with friends or followers.
### Back of Card
**Success Scenario:**
* User sends text, emoji, or media.
* Messages deliver in real time.
* User can mute or delete conversations.
* Notification is received for new messages.
**Failure Scenarios:**
* **Unauthorized:** `Please log in to send messages.`
* **Blocked:** `You cannot message this user.`
