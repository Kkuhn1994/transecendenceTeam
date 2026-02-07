/**
 * Friends List and User Management
 */
import { uiAlert, uiConfirm } from './ui_modal';

interface Friend {
  id: number;
  email: string;
  nickname: string | null;
  avatar: string;
  is_active: boolean;
  last_login: string | null;
  friendship_date: string;
}

async function getFriends(): Promise<Friend[]> {
  try {
    const response = await fetch(
      `/login_service/user/friends?t=${Date.now()}`,
      {
        credentials: 'include',
        cache: 'no-store',
      },
    );

    const raw = await response.text();
    let data: any = null;

    try {
      data = JSON.parse(raw);
    } catch {
      // ignore
    }

    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }

    return data?.friends || [];
  } catch (err: any) {
    await uiAlert(`Failed to load friends: ${err.message || err}`, 'Error');
    return [];
  }
}

async function addFriendByEmail(
  friendEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/login_service/user/friends/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ friendEmail }),
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || '';
    const raw = await response.text();

    let data: any = null;
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    if (data?.status === 'ok') return { ok: true };
    if (data?.status === 'error' || data?.error) {
      return { ok: false, error: data.error || 'Request failed' };
    }

    return { ok: false, error: `Non-JSON response (HTTP ${response.status})` };
  } catch (err) {
    return { ok: false, error: 'Network error' };
  }
}

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
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function initFriends(): Promise<void> {
  const friends = await getFriends();

  const container = document.getElementById('app');
  if (!container) return;

  const friendsHtml =
    friends.length === 0
      ? '<p style="text-align:center;padding:20px;"><i class="fas fa-user-slash"></i> No friends yet. Add some!</p>'
      : friends
          .map((f) => {
            const displayName = escapeHtml(f.nickname || f.email);
            const avatar = f.avatar || '';
            const statusIcon = f.is_active 
              ? '<i class="fas fa-circle" style="color:#00aa00;font-size:10px;"></i>' 
              : '<i class="fas fa-circle" style="color:#888;font-size:10px;"></i>';
            const statusLine = f.is_active
              ? 'Online'
              : `Last seen ${f.last_login ? new Date(f.last_login).toLocaleDateString() : 'Never'}`;
            const friendPayload = encodeURIComponent(
              JSON.stringify({
                id: f.id,
                email: f.email,
                nickname: f.nickname,
                avatar: f.avatar,
              }),
            );

            return `
              <div class="friend-item card-row">
                <img src="${avatar}"
                     alt="Avatar"
                     class="friend-avatar"
                     onerror="this.style.display='none';" />
                <div class="friend-info" style="flex:1; margin-right: 15px;">
                  <h3 style="margin:0;">${displayName}</h3>
                  <p style="margin:5px 0; color:#888;">${statusIcon} ${statusLine}</p>
                </div>

                <div class="friend-actions" style="display: flex; gap: 10px; align-items: center;">
                  <button class="view-profile-btn btn btn-primary"
                          data-friend='${friendPayload}'
                          style="margin-top: 0; height: 38px; min-width: 120px;">
                    <i class="fas fa-user"></i> View Profile
                  </button>

                  <button class="remove-friend-btn btn btn-danger"
                          data-friend-id="${f.id}"
                          style="margin-top: 0; height: 38px; min-width: 100px;">
                    <i class="fas fa-user-times"></i> Remove
                  </button>
                </div>
              </div>
            `;
          })
          .join('');

  container.innerHTML = `
    <div class="page-container">
      <div class="nav">
        <button id="navHome"><i class="fas fa-home"></i> Home</button>
        <button id="navPlay"><i class="fas fa-gamepad"></i> Play</button>
        <button id="navProfile"><i class="fas fa-user"></i> Profile</button>
        <button id="navFriends"><i class="fas fa-users"></i> Friends</button>
        <button id="navLogout"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>

      <h1><i class="fas fa-users"></i> Friends List</h1>

      <div class="add-friend" style="margin:20px 0; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <input type="text" id="friendEmailInput"
               class="form-control"
               placeholder="Enter friend's username"
               style="width:250px;" />
        <button id="addFriendBtn" class="btn btn-primary" style="margin-top: 0; height: 38px;">
          <i class="fas fa-user-plus"></i> Add Friend
        </button>
      </div>

      <div class="friends-list">
        ${friendsHtml}
      </div>

      <div style="margin-top:20px;">
        <button id="backHomeBtn" class="btn btn-secondary">
          <i class="fas fa-arrow-left"></i> Back to Home
        </button>
      </div>
    </div>
  `;

  // Handle navigation
  const handleNav = async () => {
    const homeBtn = document.getElementById('navHome');
    const playBtn = document.getElementById('navPlay');
    const profileBtn = document.getElementById('navProfile');
    const friendsBtn = document.getElementById('navFriends');
    const logoutBtn = document.getElementById('navLogout');

    if (homeBtn) homeBtn.addEventListener('click', () => { location.hash = '#/home'; });
    if (playBtn) playBtn.addEventListener('click', () => { location.hash = '#/play'; });
    if (profileBtn) profileBtn.addEventListener('click', () => { location.hash = '#/profile'; });
    if (friendsBtn) friendsBtn.addEventListener('click', () => { location.hash = '#/friends'; });
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await fetch('/login_service/logout', { method: 'POST' });
        location.hash = '#/';
      });
    }
  };

  await handleNav();

  document.getElementById('backHomeBtn')?.addEventListener('click', () => {
    location.hash = '#/home';
  });

  const addBtn = document.getElementById('addFriendBtn');
  const friendEmailInput = document.getElementById(
    'friendEmailInput',
  ) as HTMLInputElement | null;

  addBtn?.addEventListener('click', async () => {
    const friendEmail = (friendEmailInput?.value || '').trim();

    if (!friendEmail) {
      await uiAlert('Please enter a valid username', 'Missing info');
      return;
    }

    const result = await addFriendByEmail(friendEmail);

    if (result.ok) {
      await uiAlert('Friend added!', 'Success');
      if (friendEmailInput) friendEmailInput.value = '';
      await initFriends();
    } else {
      await uiAlert(result.error || 'Failed to add friend.', 'Error');
    }
  });

  // See profile
  document.querySelectorAll('.view-profile-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      const raw = el.dataset.friend || '';

      try {
        const decoded = decodeURIComponent(raw);
        const parsed = JSON.parse(decoded);
        const friendId = parsed?.id;

        // optional cache
        sessionStorage.setItem('friendProfile', decoded);

        location.hash = `#/profile?userId=${friendId}`;
      } catch (err) {
        location.hash = '#/profile';
      }
    });
  });

  // Remove friend
  document.querySelectorAll('.remove-friend-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement;
      const friendId = parseInt(target.dataset.friendId || '0', 10);

      if (!friendId) {
        await uiAlert('Invalid friend id', 'Error');
        return;
      }

      const ok = await uiConfirm(
        'Remove this friend?',
        'Confirm',
        'Remove',
        'Cancel',
      );
      if (!ok) return;

      const success = await removeFriend(friendId);

      if (success) {
        await uiAlert('Friend removed', 'Done');
        await initFriends();
      } else {
        await uiAlert('Failed to remove friend', 'Error');
      }
    });
  });
}
