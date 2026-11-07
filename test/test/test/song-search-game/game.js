let currentVideo = null;
let favorites = [];
let cachedResults = {};

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

async function searchSongs() {
    const query = document.getElementById('songInput').value.trim();

    if (!query) {
        showError('אנא הקלד את שם השיר או הזמר');
        return;
    }

    showLoading(true);
    clearError();

    try {
        // Check cache first
        if (cachedResults[query]) {
            displayResults(cachedResults[query]);
            if (cachedResults[query].length === 0) {
                document.getElementById('noResults').textContent = `לא נמצאו תוצאות עבור "${query}"`;
                document.getElementById('noResults').style.display = 'block';
            } else {
                document.getElementById('noResults').style.display = 'none';
            }
            showLoading(false);
            return;
        }

        // Search MusicBrainz API (no key required)
        const response = await fetch(
            `https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(query)}&fmt=json&limit=12`,
            {
                headers: {
                    'User-Agent': 'KidlearnSongSearch/1.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error('בעיה בחיבור לשרת המוזיקה');
        }

        const data = await response.json();
        const results = [];

        if (data.recordings && data.recordings.length > 0) {
            data.recordings.forEach(recording => {
                // Get artist name
                let artistName = 'אמן לא ידוע';
                if (recording['artist-credit'] && recording['artist-credit'].length > 0) {
                    artistName = recording['artist-credit'][0].artist.name;
                }

                results.push({
                    id: recording.id,
                    title: recording.title,
                    artist: artistName,
                    thumbnail: getThumbnailForSong(recording.title, artistName)
                });
            });
        }

        // Cache results
        cachedResults[query] = results;

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
            <img src="${escapeHtml(song.thumbnail)}" alt="${escapeHtml(song.title)}" class="result-thumbnail" onerror="this.src='https://via.placeholder.com/320x180?text=🎵'">
            <div class="result-title">${escapeHtml(song.title)}</div>
            <div class="result-channel">${escapeHtml(song.artist)}</div>
        `;

        resultDiv.onclick = () => searchYouTube(song.title, song.artist);
        resultsDiv.appendChild(resultDiv);
    });
}

// Search YouTube for the actual video without API
async function searchYouTube(title, artist) {
    showLoading(true);

    try {
        const searchQuery = `${title} ${artist}`;

        // Try to find video ID from YouTube search page
        const response = await fetch(
            `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
            {
                mode: 'no-cors'
            }
        );

        // Since we can't parse YouTube directly due to CORS,
        // we'll construct a search URL and guide user to it
        playVideoSearchResult(title, artist, searchQuery);
    } catch (error) {
        // Fallback: construct search URL
        playVideoSearchResult(title, artist, `${title} ${artist}`);
    } finally {
        showLoading(false);
    }
}

function playVideoSearchResult(title, artist, searchQuery) {
    currentVideo = {
        title: title,
        artist: artist,
        searchQuery: searchQuery
    };

    const playerContainer = document.getElementById('playerContainer');
    const youtubePlayer = document.getElementById('youtubePlayer');
    const nowPlayingTitle = document.getElementById('nowPlayingTitle');

    // Create YouTube search embed
    const youtubeSearchUrl = `https://www.youtube.com/embed/results?search_query=${encodeURIComponent(searchQuery)}`;

    youtubePlayer.src = youtubeSearchUrl;
    nowPlayingTitle.textContent = `${title} - ${artist}`;
    playerContainer.style.display = 'block';

    // Scroll to player
    playerContainer.scrollIntoView({ behavior: 'smooth' });
}

function addToFavorites() {
    if (!currentVideo) {
        showError('בחר שיר תחילה');
        return;
    }

    const favId = `${currentVideo.title}-${currentVideo.artist}`;

    // Check if already in favorites
    if (favorites.some(fav => fav.id === favId)) {
        showError('השיר כבר בשירים האהובים');
        return;
    }

    favorites.push({
        id: favId,
        title: currentVideo.title,
        artist: currentVideo.artist,
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

function removeFavorite(favId) {
    favorites = favorites.filter(fav => fav.id !== favId);
    saveFavorites();
    displayFavorites();
}

function playFavorite(title, artist, searchQuery) {
    playVideoSearchResult(title, artist, searchQuery);
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
        const favId = `${fav.title}-${fav.artist}`;
        favDiv.innerHTML = `
            <div class="favorite-item-title" onclick="playFavorite('${escapeHtml(fav.title)}', '${escapeHtml(fav.artist)}', '${escapeHtml(fav.title + ' ' + fav.artist)}')">${escapeHtml(fav.title)} - ${escapeHtml(fav.artist)}</div>
            <button class="favorite-remove" onclick="removeFavorite('${escapeHtml(favId)}')">הסר</button>
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

function getThumbnailForSong(title, artist) {
    // Use a placeholder or generate a data URL with song info
    return `https://via.placeholder.com/320x180?text=${encodeURIComponent(title.substring(0, 20))}`;
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
