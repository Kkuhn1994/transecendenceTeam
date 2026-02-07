export {};

/**
 * Friends List and User Management (with friend requests)
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
  relation?: 'accepted' | 'incoming_pending' | 'outgoing_pending';
  request_id?: number | null;
}

async function getFriends(): Promise<Friend[]> {
  try {
    const response = await fetch(`/friends_service/user/friends?t=${Date.now()}`, {
      credentials: 'include',
      cache: 'no-store',
    });

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
  friendEmail: string
): Promise<{ ok: boolean; mode?: 'pending' | 'accepted'; error?: string }> {
  try {
    const response = await fetch('/friends_service/user/friends/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ friendEmail }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data?.error || `HTTP ${response.status}` };

    if (data?.status === 'ok') {
      const mode = data.mode === 'accepted' ? 'accepted' : 'pending';
      return { ok: true, mode };
    }

    return { ok: false, error: data?.error || 'Request failed' };
  } catch (err) {
    return { ok: false, error: 'Network error' };
  }
}

async function acceptFriendRequest(requestId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/friends_service/user/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ requestId }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.status === 'ok') return { ok: true };
    return { ok: false, error: data?.error || `HTTP ${response.status}` };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

async function rejectFriendRequest(requestId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/friends_service/user/friends/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ requestId }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.status === 'ok') return { ok: true };
    return { ok: false, error: data?.error || `HTTP ${response.status}` };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/**
 * Removes accepted friendship AND also cancels pending requests (your backend does both).
 */
async function removeFriend(friendId: number): Promise<boolean> {
  try {
    const response = await fetch('/friends_service/user/friends/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ friendId }),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    return response.ok && data?.status === 'ok';
  } catch {
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

function statusLine(f: Friend): string {
  if (f.is_active) return 'Online';
  return `Last seen ${f.last_login ? new Date(f.last_login).toLocaleString() : 'Never'}`;
}

function relationBadge(f: Friend): string {
  const rel = f.relation || 'accepted';
  if (rel === 'incoming_pending') return `<span class="badge-warn"><i class="fas fa-clock"></i> Pending approval</span>`;
  if (rel === 'outgoing_pending') return `<span class="badge-muted"><i class="fas fa-paper-plane"></i> Request sent</span>`;
  return '';
}

export async function initFriends(): Promise<void> {
  const root = document.getElementById('friendsRoot') as HTMLDivElement | null;

  // Fallback: if someone calls initFriends without the /friends view loaded
  const container = root || (document.getElementById('app') as HTMLDivElement | null);
  if (!container) return;

  const friends = await getFriends();

  const listHtml =
    friends.length === 0
      ? `<p class="text-center" style="padding:12px; margin:0;"><i class="fas fa-user-slash"></i> No friends yet. Add someone.</p>`
      : friends
          .map((f) => {
            const rel = f.relation || 'accepted';
            const isAccepted = rel === 'accepted';
            const isIncoming = rel === 'incoming_pending';
            const isOutgoing = rel === 'outgoing_pending';

            const displayName = escapeHtml(f.nickname || f.email);
            const avatar = f.avatar || '';
            const statusIcon = f.is_active
              ? '<i class="fas fa-circle" style="color:#00aa00;font-size:10px;"></i>'
              : '<i class="fas fa-circle" style="color:#888;font-size:10px;"></i>';

            const friendPayload = encodeURIComponent(
              JSON.stringify({
                id: f.id,
                email: f.email,
                nickname: f.nickname,
                avatar: f.avatar,
              })
            );

            let actionsHtml = '';

            if (isAccepted) {
              actionsHtml = `
                <button class="view-profile-btn btn btn-primary" data-friend='${friendPayload}'>
                  <i class="fas fa-user"></i> View
                </button>
                <button class="remove-friend-btn btn btn-danger" data-friend-id="${f.id}">
                  <i class="fas fa-user-times"></i> Remove
                </button>
              `;
            } else if (isIncoming) {
              actionsHtml = `
                <button class="accept-friend-btn btn btn-primary" data-request-id="${f.request_id || ''}">
                  <i class="fas fa-check"></i> Accept
                </button>
                <button class="reject-friend-btn btn" data-request-id="${f.request_id || ''}">
                  <i class="fas fa-times"></i> Reject
                </button>
              `;
            } else if (isOutgoing) {
              // Your backend remove endpoint deletes pending requests too → "Cancel request"
              actionsHtml = `
                <button class="cancel-request-btn btn btn-danger" data-friend-id="${f.id}">
                  <i class="fas fa-ban"></i> Cancel
                </button>
              `;
            }

            return `
              <div class="card-row friend-row">
                ${
                  avatar
                    ? `<img src="${avatar}" alt="Avatar" class="friend-avatar" onerror="this.style.display='none';" />`
                    : `<div class="friend-avatar" style="display:flex; align-items:center; justify-content:center; opacity:0.85;">
                        <i class="fas fa-user"></i>
                       </div>`
                }

                <div class="friend-main">
                  <div class="friend-title">
                    <strong>${displayName}</strong>
                    ${relationBadge(f)}
                  </div>
                  <div class="friend-meta">${statusIcon} ${escapeHtml(statusLine(f))}</div>
                </div>

                <div class="friend-actions">
                  ${actionsHtml}
                </div>
              </div>
            `;
          })
          .join('');

  // If we’re inside #friendsRoot, only render the inner content.
  // If we’re in #app fallback, render a minimal page (should rarely happen).
  const inner = `
    <div class="add-friend" style="margin-bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <input
        type="text"
        id="friendEmailInput"
        class="form-control"
        placeholder="Enter username"
        style="width:260px;"
      />
      <button id="addFriendBtn" class="btn btn-primary" style="margin-top:0;">
        <i class="fas fa-user-plus"></i> Add
      </button>
    </div>

    <div class="friends-list" style="display:flex; flex-direction:column; gap:10px;">
      ${listHtml}
    </div>
  `;

  if (root) root.innerHTML = inner;
  else container.innerHTML = inner;

  // Add friend
  const addBtn = document.getElementById('addFriendBtn');
  const friendEmailInput = document.getElementById('friendEmailInput') as HTMLInputElement | null;

  addBtn?.addEventListener('click', async () => {
    const friendEmail = (friendEmailInput?.value || '').trim();
    if (!friendEmail) {
      await uiAlert('Please enter a username.', 'Missing info');
      return;
    }

    const result = await addFriendByEmail(friendEmail);

    if (result.ok) {
      const msg = result.mode === 'accepted' ? 'Friend added.' : 'Friend request sent.';
      await uiAlert(msg, 'Success');
      if (friendEmailInput) friendEmailInput.value = '';
      await initFriends();
    } else {
      await uiAlert(result.error || 'Failed to add friend.', 'Error');
    }
  });

  // View profile (accepted only)
  document.querySelectorAll('.view-profile-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = btn as HTMLElement;
      const raw = el.dataset.friend || '';

      try {
        const decoded = decodeURIComponent(raw);
        const parsed = JSON.parse(decoded);
        const friendId = parsed?.id;

        sessionStorage.setItem('friendProfile', decoded);
        location.hash = `#/profile?userId=${friendId}`;
      } catch {
        location.hash = '#/profile';
      }
    });
  });

  // Remove friend (accepted)
  document.querySelectorAll('.remove-friend-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement;
      const friendId = parseInt(target.dataset.friendId || '0', 10);

      if (!friendId) return uiAlert('Invalid friend id.', 'Error');

      const ok = await uiConfirm('Remove this friend?', 'Confirm', 'Remove', 'Cancel');
      if (!ok) return;

      const success = await removeFriend(friendId);
      if (success) {
        await uiAlert('Friend removed.', 'Done');
        await initFriends();
      } else {
        await uiAlert('Failed to remove friend.', 'Error');
      }
    });
  });

  // Cancel outgoing request
  document.querySelectorAll('.cancel-request-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement;
      const friendId = parseInt(target.dataset.friendId || '0', 10);

      if (!friendId) return uiAlert('Invalid friend id.', 'Error');

      const ok = await uiConfirm('Cancel this friend request?', 'Confirm', 'Cancel request', 'Keep');
      if (!ok) return;

      const success = await removeFriend(friendId);
      if (success) {
        await uiAlert('Request cancelled.', 'Done');
        await initFriends();
      } else {
        await uiAlert('Failed to cancel request.', 'Error');
      }
    });
  });

  // Accept incoming request
  document.querySelectorAll('.accept-friend-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement;
      const requestId = Number(target.dataset.requestId || 0);
      if (!requestId) return uiAlert('Invalid request id.', 'Error');

      const ok = await uiConfirm('Accept this friend request?', 'Confirm', 'Accept', 'Cancel');
      if (!ok) return;

      const result = await acceptFriendRequest(requestId);
      if (result.ok) {
        await uiAlert('Friend request accepted.', 'Success');
        await initFriends();
      } else {
        await uiAlert(result.error || 'Failed to accept request.', 'Error');
      }
    });
  });

  // Reject incoming request
  document.querySelectorAll('.reject-friend-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLElement;
      const requestId = Number(target.dataset.requestId || 0);
      if (!requestId) return uiAlert('Invalid request id.', 'Error');

      const ok = await uiConfirm('Reject this friend request?', 'Confirm', 'Reject', 'Cancel');
      if (!ok) return;

      const result = await rejectFriendRequest(requestId);
      if (result.ok) {
        await uiAlert('Friend request rejected.', 'Done');
        await initFriends();
      } else {
        await uiAlert(result.error || 'Failed to reject request.', 'Error');
      }
    });
  });
}
