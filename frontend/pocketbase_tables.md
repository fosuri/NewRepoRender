# PocketBase Tables Structure

## 1. `users` (System Collection)
This is the built-in PocketBase collection for authentication. You will need to add custom fields for roles and subscriptions.

**Fields to add:**
- `role` (Type: `Select`, Options: `admin`, `employee`, Required: true)
- `is_pro` (Type: `Bool`, Default: false) - Used to track Stripe payments for PRO features.

**API Rules:**
- List/Search: `@request.auth.id != ""` (Logged in users can see users)
- View: `@request.auth.id != ""`
- Create: `` (Anyone can register)
- Update: `id = @request.auth.id`
- Delete: `id = @request.auth.id`

---

## 2. `devices` (Base Collection)
This collection holds the inventory data.

**Fields:**
- `name` (Type: `Text`, Required: true) - e.g., "MacBook Pro", "Thinkpad"
- `status` (Type: `Select`, Options: `available`, `in_use`, Required: true)
- `assigned_to` (Type: `Relation`, Collection: `users`, Max Select: 1) - The user currently using the device.
- `notes` (Type: `Text`) - For employees to note usage or condition.

**API Rules:**
- List/Search: `@request.auth.id != ""` (Any logged-in user)
- View: `@request.auth.id != ""`
- Create: `@request.auth.role = "admin"` (Only admins can add devices)
- Update: `@request.auth.id != ""` (Anyone can update status/notes/assigned_to)
- Delete: `@request.auth.role = "admin"` (Only admins can delete)
