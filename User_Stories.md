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
---
## 8. Notifications 
### Front of Card 
> As a user, I want to receive notifications when someone interacts with my content so that I can 
stay updated. 
### Back of Card 
**Success Scenario:** 
* Notifications are triggered for likes, comments, follows, and messages. 
* User can adjust notification preferences. 
* Notifications appear in-app and optionally by email. 
**Failure Scenarios:** 
* **Disabled notifications:** `Enable notifications in your settings.` 
* **Delay or error:** `Notifications may be delayed.`
--- 
## 9. Follow/Unfollow 
### Front of Card 
> As a user, I want to follow or unfollow people so that I can control whose content appears in 
my feed. 
### Back of Card 
**Success Scenario:** 
* User follows/unfollows an account. 
* Feed updates immediately. 
* System prevents following self. 
**Failure Scenarios:** 
* **Unauthorized:** `Please log in to follow users.` 
* **Server issue:** `Unable to update follow status.`
--- 
## 10. Search 
### Front of Card 
> As a user, I want to search for users or posts so that I can quickly find specific content. 
### Back of Card 
**Success Scenario:** 
* User searches by username, hashtags, or keywords. 
* Relevant results are displayed. 
* Recent searches are saved. 
**Failure Scenarios:** 
* **No matches:** `No results found.` 
* **Server error:** `Unable to fetch results.`
--- 
## 11. Save/Bookmark 
### Front of Card 
> As a user, I want to save posts so that I can revisit them later. 
### Back of Card 
**Success Scenario:** 
* User bookmarks a post. 
* Saved posts appear in a separate section of profile. 
* User can remove bookmarks. 
**Failure Scenarios:** 
* **Unauthorized:** `Login required to save posts.` 
* **Server issue:** `Unable to save post.`
--- 
## 12. Edit/Delete/Archive Post 
### Front of Card 
> As a user, I want to edit, delete, or archive my posts so that I can correct mistakes or remove 
unwanted content. 
### Back of Card 
**Success Scenario:** 
* User edits caption or tags. 
* User deletes post permanently. 
* Changes update instantly in feed. 
**Failure Scenarios:** 
* **Unauthorized:** `You can only edit your own posts.` 
* **Server error:** `Action failed. Try again later.`
--- 
## 13. Profile Management 
### Front of Card 
> As a registered user, I want to customize my profile with photos, bio, and personal information 
so that others can discover and connect with me. 
### Back of Card 
**Success Scenario:** 
* User uploads profile picture. 
* User edits bio and personal info. 
* Privacy settings are updated successfully. 
**Failure Scenarios:** 
* **Invalid file type:** `Upload a valid image format.` 
* **Unauthorized:** `Please log in to update your profile.` 
* **Server issue:** `Unable to save changes.`
--- 
## 14. Report/Block 
### Front of Card 
> As a user, I want to report or block inappropriate content or people so that my experience is 
safe. 
### Back of Card 
**Success Scenario:** 
* User reports posts, comments, or accounts. 
* User blocks another account. 
* Report is sent to moderators. 
* Blocked users cannot interact. 
**Failure Scenarios:** 
* **Unauthorized:** `Please log in to report or block.` 
* **Server error:** `Unable to process your request.`
---
