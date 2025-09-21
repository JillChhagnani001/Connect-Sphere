# Conflicts Between ConnectSphere Epics

### **Conflict between EPIC 2 and EPIC 4**
A direct conflict exists between a user's ability to freely create and share content (**EPIC 2**) and the need to moderate that content for safety (**EPIC 4**). For example, a "System Admin" suspending a user (**EPIC 4**) directly removes their ability to "Create Post" or "Comment on Post" (**EPIC 2**), creating a tension between user freedom and platform control.

---

### **Conflict between EPIC 2 and EPIC 3**
The ability for users to "Share/Repost" content (**EPIC 2**) and "Search" for it (**EPIC 3**) can conflict with a user's desire for privacy. If a user posts content and their profile is set to "private," a "Search" feature might still be able to surface that content to people who aren't followers, which is a breach of privacy. The implementation of "Search" has to be carefully balanced with a user's privacy settings to avoid this conflict.

---

### **Conflict between EPIC 5 and EPIC 4**
A conflict can occur when a "Creator" who generates significant engagement and revenue (tracked by the "Creator Dashboard" in **EPIC 5**) violates a platform policy. The "System Admin" suspending a violating user (**EPIC 4**) directly harms the creator's business and the platform's financial metrics (**EPIC 6**), creating a conflict between platform safety and business interests. The need to enforce rules can clash with the desire to retain high-value users.

---

### **Conflict between EPIC 3 and EPIC 1**
The "Search" feature (**EPIC 3**) can conflict with user privacy in "Profile Management" (**EPIC 1**). A user may want their profile to be public, but a "Search" that makes their personal information or posts too easily discoverable could be a privacy concern. For instance, a search engine indexing a public profile could expose it to a wider audience than the user intended.

---

### **Conflict between EPIC 5 and EPIC 6**
A "Creator" may request a highly specialized or custom feature for their dashboard (**EPIC 5**) that the "Developer Team" finds difficult to maintain or integrate (**EPIC 6**). The desire to provide a great experience for creators can conflict with the need for a simple, scalable, and maintainable system. Building custom, one-off tools can add technical debt and make the platform less healthy in the long term.
