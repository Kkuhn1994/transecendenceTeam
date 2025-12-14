/**
 * Friends List and User Management
 */

interface Friend {
  id: number;
  email: string;
  nickname: string | null;
  avatar: string;
  is_active: boolean;
  last_login: string | null;
  friendship_date: string;
}

/**
 * Get friends list
 */
async function getFriends(): Promise<Friend[]> {
  try {
    const response = await fetch('/login_service/user/friends', {
      credentials: 'include',
    });
    
    if (!response.ok) return [];
    const data = await response.json();
    return data.friends || [];
  } catch (err) {
    console.error('Failed to get friends:', err);
    return [];
  }
}

/**
 * Add a friend by email
 */
async function addFriendByEmail(friendEmail: string): Promise<boolean> {
  try {
    const response = await fetch('/login_service/user/friends/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ friendEmail }),
    });
    
    return response.ok;
  } catch (err) {
    console.error('Failed to add friend:', err);
    return false;
  }
}

/**
 * Remove a friend
 */
async function removeFriend(friendId: number): Promise<boolean> {
  try {
    const response = await fetch('/login_service/user/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ friendId }),
    });
    
    return response.ok;
  } catch (err) {
    console.error('Failed to remove friend:', err);
    return false;
  }
}

/**
 * Update user profile
 */
async function updateProfile(data: { nickname?: string; avatar?: string }): Promise<boolean> {
  try {
    const response = await fetch('/login_service/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    
    return response.ok;
  } catch (err) {
    console.error('Failed to update profile:', err);
    return false;
  }
}

/**
 * Render friends list page
 */
export async function initFriends(): Promise<void> {
  const friends = await getFriends();
  
  const container = document.getElementById('app');
  if (!container) return;

  container.innerHTML = `
    <div class="page-container">
      <div class="nav">
        <button id="navHome">Home</button>
        <button id="navPlay">Play</button>
        <button id="navProfile">Profile</button>
        <button id="navLogout">Logout</button>
      </div>
      <h1>👥 Friends List</h1>
      
      <div class="add-friend mb-4">
        <div class="mb-3">
          <label for="friendEmailInput" class="form-label">Add Friend</label>
          <input type="email" id="friendEmailInput" class="form-control" placeholder="Enter friend's email" required>
        </div>
        <button id="addFriendBtn" class="btn btn-primary">Add Friend</button>
      </div>

      <div class="friends-list">
        ${friends.length === 0 ? '<p>No friends yet. Add some!</p>' : friends.map(f => `
          <div class="friend-item" style="display: flex; align-items: center; padding: 15px; border: 1px solid rgba(0, 255, 255, 0.3); margin: 10px 0; border-radius: 8px; background: rgba(26, 26, 46, 0.5);">
            <img src="${f.avatar || '/avatars/default.jpg'}" alt="Avatar" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 15px; object-fit: cover; border: 1px solid #00ffff;">
            <div class="friend-info" style="flex: 1;">
              <h3 style="margin: 0; color: #ffffff;">
                <a href="#/user/${f.id}" style="color: #00ffff; text-decoration: none; cursor: pointer;">${f.nickname || f.email}</a>
              </h3>
              <p style="margin: 5px 0; color: #cccccc;">${f.is_active ? '🟢 Online' : `⚫ Last seen ${f.last_login ? new Date(f.last_login).toLocaleDateString() : 'Never'}`}</p>
            </div>
            <button class="remove-friend-btn btn btn-secondary" data-friend-id="${f.id}">Remove</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Navigation handlers
  const homeBtn = document.getElementById('navHome');
  const playBtn = document.getElementById('navPlay');
  const profileBtn = document.getElementById('navProfile');
  const logoutBtn = document.getElementById('navLogout');

  if (homeBtn) homeBtn.addEventListener('click', () => (location.hash = '#/home'));
  if (playBtn) playBtn.addEventListener('click', () => (location.hash = '#/play'));
  if (profileBtn) profileBtn.addEventListener('click', () => (location.hash = '#/profile'));

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/login_service/logout', { method: 'POST' });
      (window as any).currentSessionId = undefined;
      location.hash = '#/';
    });
  }

  // Add friend handler
  const addBtn = document.getElementById('addFriendBtn');
  const friendEmailInput = document.getElementById('friendEmailInput') as HTMLInputElement;

  addBtn?.addEventListener('click', async () => {
    const friendEmail = friendEmailInput.value.trim();
    
    if (!friendEmail) {
      alert('Please enter an email address');
      return;
    }

    const success = await addFriendByEmail(friendEmail);
    
    if (success) {
      alert('Friend added!');
      initFriends();
    } else {
      alert('Failed to add friend. They may not exist or already be your friend.');
    }
  });

  // Remove friend handlers
  document.querySelectorAll('.remove-friend-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const friendId = parseInt((e.target as HTMLElement).dataset.friendId || '0');
      
      if (confirm('Remove this friend?')) {
        const success = await removeFriend(friendId);
        
        if (success) {
          alert('Friend removed');
          initFriends();
        } else {
          alert('Failed to remove friend');
        }
      }
    });
  });
}

export { getFriends, addFriendByEmail, removeFriend, updateProfile };
