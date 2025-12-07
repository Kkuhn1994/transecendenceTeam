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
    <div class="friends-container" style="max-width: 800px; margin: 0 auto; padding: 20px;">
      <h1>Friends List</h1>
      
      <div class="add-friend" style="margin: 20px 0;">
        <input type="email" id="friendEmailInput" placeholder="Enter friend's email" style="padding: 8px; margin-right: 10px; width: 250px;">
        <button id="addFriendBtn" style="padding: 8px 16px;">Add Friend</button>
      </div>

      <div class="friends-list">
        ${friends.length === 0 ? '<p>No friends yet. Add some!</p>' : friends.map(f => `
          <div class="friend-item" style="display: flex; align-items: center; padding: 15px; border: 1px solid #333; margin: 10px 0; border-radius: 8px;">
            <img src="${f.avatar}" alt="Avatar" style="width: 50px; height: 50px; border-radius: 50%; margin-right: 15px;">
            <div class="friend-info" style="flex: 1;">
              <h3 style="margin: 0;">${f.nickname || f.email}</h3>
              <p style="margin: 5px 0; color: #888;">${f.is_active ? '🟢 Online' : `⚫ Last seen ${f.last_login ? new Date(f.last_login).toLocaleDateString() : 'Never'}`}</p>
            </div>
            <button class="remove-friend-btn" data-friend-id="${f.id}" style="padding: 6px 12px; background: #d9534f; color: white; border: none; border-radius: 4px; cursor: pointer;">Remove</button>
          </div>
        `).join('')}
      </div>

      <div style="margin-top: 20px;">
        <button onclick="location.hash='#/home'" style="padding: 10px 20px;">Back to Home</button>
      </div>
    </div>
  `;

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
