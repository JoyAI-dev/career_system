# Q-chat: Chat System End-to-End Test

## Purpose
Verify the real-time chat system works correctly:
- Friend request send/accept workflow
- Private messaging between friends
- Group chat messaging in community/virtual group
- Student Network drawer functionality

## Test Users
| User | Password | Role |
|------|----------|------|
| a14  | a14      | USER |
| a15  | a15      | USER |

Both users are pre-seeded with:
- Completed preferences (same grouping → same community)
- Completed questionnaire (skip to dashboard)
- Announcement marked as viewed (no countdown)
- Both in community "Chat Test Community" and virtual group "Chat Test Group"

## Pre-conditions
- Run `npx tsx e2e/uiqa/Q-chat/seed.ts` to prepare test data
- Server running with WebSocket support (`server.ts`)

## Test Steps

### Phase 1: Login Both Users (2 browser sessions)

**CP-1**: Open Session A, navigate to login page, login as `a14`/`a14`
- Expected: Dashboard loads, no questionnaire/preference redirect
- Expected: Secondary nav bar visible with chat icons
- Expected: Floating chat button visible in bottom-right

**CP-2**: Open Session B (different browser/incognito), login as `a15`/`a15`
- Expected: Same as CP-1

### Phase 2: Student Network Discovery

**CP-3**: In Session A, click "Student Network" (学生网络) in secondary nav bar
- Expected: Drawer opens showing "Chat Test Community" and "Chat Test Group"
- Expected: Both a14 and a15 listed as members

**CP-4**: In the drawer, find user a15 in the member list
- Expected: a15 shown with username and "Add Friend" button

### Phase 3: Friend Request Flow

**CP-5**: In Session A, click "Add Friend" button next to a15
- Expected: Button changes to "Sent" or "Already sent" state
- Expected: Friend request notification created for a15

**CP-6**: In Session B, check notification bell for friend request
- Expected: Toast notification appears with Accept/Reject options
- OR: Click notification bell to see pending friend request

**CP-7**: In Session B, accept the friend request
- Expected: Friendship status changes to ACCEPTED
- Expected: a14 appears in friend list

### Phase 4: Private Chat

**CP-8**: In Session A, open chat popup (click floating button or nav bar chat icon)
- Expected: Chat popup opens with contact list showing a15 as friend

**CP-9**: In Session A, click on a15 in friend list to open private chat
- Expected: Message area opens with private chat header

**CP-10**: In Session A, type and send a message: "Hello from a14!"
- Expected: Message appears in chat area with sender info

**CP-11**: In Session B, open chat popup
- Expected: a14 visible in friend list (possibly with unread indicator)

**CP-12**: In Session B, click on a14 to open private chat
- Expected: Message "Hello from a14!" visible in chat history

**CP-13**: In Session B, send reply: "Hi a14, this is a15!"
- Expected: Message appears in Session B's chat area

**CP-14**: In Session A, verify receipt
- Expected: "Hi a14, this is a15!" appears in Session A's chat area (real-time via WebSocket)

### Phase 5: Group Chat

**CP-15**: In Session A, click on "Chat Test Community" in contact list
- Expected: Group chat opens with community name in header

**CP-16**: In Session A, send group message: "Hello community from a14!"
- Expected: Message appears in group chat

**CP-17**: In Session B, click on "Chat Test Community" in contact list
- Expected: Group chat opens, message from a14 visible

**CP-18**: In Session B, send group message: "Community reply from a15!"
- Expected: Both sessions see the message

**CP-19**: Repeat CP-15~CP-18 for "Chat Test Group" (virtual group)
- Expected: Virtual group chat works the same as community chat

### Phase 6: Verification

**CP-20**: Verify WebSocket connection indicator
- Expected: Green dot on floating chat button indicating connected

**CP-21**: Check external link handling - send a message with URL like "Check https://example.com"
- Expected: URL rendered as clickable link
- Expected: Clicking URL opens external link warning dialog
