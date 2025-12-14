export async function initProfile() {
  const infoDiv = document.getElementById('profileInfo') as HTMLDivElement | null;
  const historyBtn = document.getElementById('viewHistory') as HTMLButtonElement | null;
  const avatarImg = document.getElementById('currentAvatar') as HTMLImageElement | null;
  const avatarForm = document.getElementById('avatarForm') as HTMLFormElement | null;
  const avatarError = document.getElementById('avatarError') as HTMLDivElement | null;
  const avatarSuccess = document.getElementById('avatarSuccess') as HTMLDivElement | null;

  if (!infoDiv) return;

  try {
    const res = await fetch('/profile/me');
    const data = await res.json();

    if (!res.ok) {
      infoDiv.textContent = data.error || 'Could not load profile.';
      return;
    }

    const winratePercent = (data.winrate * 100).toFixed(1);

    infoDiv.innerHTML = `
      <p>Email: ${data.email}</p>
      <p>Games played: ${data.gamesPlayed}</p>
      <p>Wins: ${data.wins}</p>
      <p>Winrate: ${winratePercent}%</p>
    `;

    // Get user details from login service to get avatar
    const userRes = await fetch('/login_service/auth/me', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (userRes.ok) {
      const userData = await userRes.json();
      if (avatarImg && userData.avatar) {
        avatarImg.src = userData.avatar;
      }
    }
  } catch (err) {
    console.error('Error loading profile:', err);
    infoDiv.textContent = 'Network error.';
  }

  // Handle avatar upload
  if (avatarForm) {
    avatarForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const fileInput = document.getElementById('avatarFile') as HTMLInputElement;
      if (!fileInput.files || fileInput.files.length === 0) {
        showAvatarError('Please select a file');
        return;
      }

      const file = fileInput.files[0];
      
      // Validate file size (2MB)
      if (file.size > 2 * 1024 * 1024) {
        showAvatarError('File size must be less than 2MB');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        showAvatarError('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        const uploadRes = await fetch('/profile/avatar', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        const uploadData = await uploadRes.json();

        if (uploadRes.ok) {
          showAvatarSuccess('Avatar updated successfully!');
          if (avatarImg) {
            avatarImg.src = uploadData.avatar;
          }
          fileInput.value = ''; // Clear the file input
        } else {
          showAvatarError(uploadData.error || 'Failed to upload avatar');
        }
      } catch (err) {
        console.error('Avatar upload error:', err);
        showAvatarError('Network error during upload');
      }
    });
  }

  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      location.hash = '#/history';
    });
  }

  function showAvatarError(message: string) {
    if (avatarError && avatarSuccess) {
      avatarError.textContent = message;
      avatarError.style.display = 'block';
      avatarSuccess.style.display = 'none';
    }
  }

  function showAvatarSuccess(message: string) {
    if (avatarError && avatarSuccess) {
      avatarSuccess.textContent = message;
      avatarSuccess.style.display = 'block';
      avatarError.style.display = 'none';
    }
  }
}

export async function initHistory() {
  const container = document.getElementById('historyContainer') as HTMLDivElement | null;
  if (!container) return;

  try {
    const res = await fetch('/profile/history');
    const data = await res.json();

    if (!res.ok) {
      container.textContent = data.error || 'Could not load history.';
      return;
    }

    const matches = data.matches || [];
    if (matches.length === 0) {
      container.textContent = 'No matches played yet.';
      return;
    }

    let html = `<table border="1" cellpadding="4" cellspacing="0">
      <tr>
        <th>ID</th>
        <th>Player 1</th>
        <th>Player 2</th>
        <th>Score</th>
        <th>Winner</th>
        <th>Started</th>
        <th>Ended</th>
      </tr>
    `;

    for (const m of matches) {
      const winner =
        m.winner_id === m.player1_id
          ? m.player1_email
          : m.winner_id === m.player2_id
          ? m.player2_email
          : '–';

      html += `
        <tr>
          <td>${m.id}</td>
          <td>${m.player1_email}</td>
          <td>${m.player2_email}</td>
          <td>${m.score1} : ${m.score2}</td>
          <td>${winner}</td>
          <td>${m.started_at || ''}</td>
          <td>${m.ended_at || ''}</td>
        </tr>
      `;
    }

    html += `</table>`;
    container.innerHTML = html;
  } catch (err) {
    console.error('Error loading history:', err);
    container.textContent = 'Network error.';
  }
}

export async function initUserProfile(userId: string) {
  const profileTitle = document.getElementById('userProfileTitle') as HTMLElement | null;
  const profileInfo = document.getElementById('userProfileInfo') as HTMLDivElement | null;
  const backBtn = document.getElementById('backToFriends') as HTMLButtonElement | null;

  if (!profileInfo) return;

  try {
    // Get user profile data
    const res = await fetch(`/login_service/users/${userId}`);
    const data = await res.json();

    if (!res.ok) {
      profileInfo.textContent = data.error || 'Could not load user profile.';
      return;
    }

    // Update page title
    if (profileTitle) {
      profileTitle.textContent = `👤 ${data.email}'s Profile`;
    }

    // Get match statistics
    const statsRes = await fetch(`/profile/stats/${userId}`);
    let stats = { gamesPlayed: 0, wins: 0, winrate: 0 };
    
    if (statsRes.ok) {
      stats = await statsRes.json();
    }

    const winratePercent = (stats.winrate * 100).toFixed(1);

    // Display profile information (read-only)
    profileInfo.innerHTML = `
      <div class="text-center mb-4">
        <img src="${data.avatar || '/static/default-avatar.png'}" 
             alt="Avatar" 
             class="avatar" 
             style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
      </div>
      <div class="profile-stats">
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Games played:</strong> ${stats.gamesPlayed}</p>
        <p><strong>Wins:</strong> ${stats.wins}</p>
        <p><strong>Winrate:</strong> ${winratePercent}%</p>
      </div>
    `;
  } catch (err) {
    console.error('Error loading user profile:', err);
    profileInfo.textContent = 'Network error.';
  }

  // Handle back button
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      location.hash = '#/friends';
    });
  }
}
