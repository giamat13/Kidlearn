let currentVideo = null;
let favorites = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFavorites();
    displayFavorites();

    // Enter key to search
    document.getElementById('songInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchSongs();
        }
    });
});

function searchSongs() {
    const query = document.getElementById('songInput').value.trim();

    if (!query) {
        showError('אנא הקלד את שם השיר או הזמר');
        return;
    }

    showLoading(true);
    clearError();

    try {
        // Search locally in songs database
        const results = searchSongsLocal(query);

        if (results.length === 0) {
            document.getElementById('noResults').textContent = `לא נמצאו תוצאות עבור "${query}"`;
            document.getElementById('noResults').style.display = 'block';
            document.getElementById('results').innerHTML = '';
        } else {
            displayResults(results);
            document.getElementById('noResults').style.display = 'none';
        }
    } catch (error) {
        showError('שגיאה בחיפוש: ' + error.message);
        console.error('Search error:', error);
    } finally {
        showLoading(false);
    }
}

function displayResults(songs) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    songs.forEach(song => {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'result-item';
        resultDiv.innerHTML = `
            <img src="${escapeHtml(song.thumbnail)}" alt="${escapeHtml(song.title)}" class="result-thumbnail" onerror="this.src='https://via.placeholder.com/320x180?text=No+Image'">
            <div class="result-title">${escapeHtml(song.title)}</div>
            <div class="result-channel">${escapeHtml(song.artist)}</div>
        `;

        resultDiv.onclick = () => playVideo(song.id, song.title);
        resultsDiv.appendChild(resultDiv);
    });
}

function playVideo(videoId, title) {
    currentVideo = { id: videoId, title: title };

    const playerContainer = document.getElementById('playerContainer');
    const youtubePlayer = document.getElementById('youtubePlayer');
    const nowPlayingTitle = document.getElementById('nowPlayingTitle');

    // Update player
    youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    nowPlayingTitle.textContent = title;
    playerContainer.style.display = 'block';

    // Scroll to player
    playerContainer.scrollIntoView({ behavior: 'smooth' });

    // Update UI
    document.querySelectorAll('.result-item').forEach(item => {
        item.classList.remove('playing');
    });
}

function addToFavorites() {
    if (!currentVideo) {
        showError('בחר שיר תחילה');
        return;
    }

    // Check if already in favorites
    if (favorites.some(fav => fav.id === currentVideo.id)) {
        showError('השיר כבר בשירים האהובים');
        return;
    }

    favorites.push({
        id: currentVideo.id,
        title: currentVideo.title,
        addedAt: new Date().toISOString()
    });

    saveFavorites();
    displayFavorites();

    // Show success message
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ נשמר!';
    setTimeout(() => {
        btn.textContent = originalText;
    }, 2000);
}

function removeFavorite(videoId) {
    favorites = favorites.filter(fav => fav.id !== videoId);
    saveFavorites();
    displayFavorites();
}

function playFavorite(videoId, title) {
    playVideo(videoId, title);
}

function displayFavorites() {
    const favoritesSection = document.getElementById('favoritesSection');
    const favoritesList = document.getElementById('favoritesList');

    if (favorites.length === 0) {
        favoritesSection.style.display = 'none';
        return;
    }

    favoritesSection.style.display = 'block';
    favoritesList.innerHTML = '';

    favorites.forEach(fav => {
        const favDiv = document.createElement('div');
        favDiv.className = 'favorite-item';
        favDiv.innerHTML = `
            <div class="favorite-item-title" onclick="playFavorite('${escapeHtml(fav.id)}', '${escapeHtml(fav.title)}')">${escapeHtml(fav.title)}</div>
            <button class="favorite-remove" onclick="removeFavorite('${escapeHtml(fav.id)}')">הסר</button>
        `;
        favoritesList.appendChild(favDiv);
    });
}

function saveFavorites() {
    try {
        localStorage.setItem('song-search-favorites', JSON.stringify(favorites));
    } catch (e) {
        console.error('Failed to save favorites:', e);
    }
}

function loadFavorites() {
    try {
        const saved = localStorage.getItem('song-search-favorites');
        if (saved) {
            favorites = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load favorites:', e);
        favorites = [];
    }
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('active', show);
}

function clearError() {
    const errorDiv = document.getElementById('error');
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
