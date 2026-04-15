let currentApiPage = 1;
let lastResults = [];
let trendingResults = []; // NEW: Keep track of trending movies
let watchlist = JSON.parse(localStorage.getItem('myWatchlist')) || [];

// --- Execute on Page Load ---
document.addEventListener("DOMContentLoaded", () => {
    fetchTrendingMovies();
    renderWatchlist();
});

// --- Fetch Trending Movies ---

async function fetchTrendingMovies() {
    try {
        const response = await fetch("/api/trending");
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
            trendingResults = data; // Save the data globally
            renderTrending();       // Call the new render function
        } else {
            document.getElementById("trending-grid").innerHTML = `<p style="color:red;">Could not load trending movies.</p>`;
        }
    } catch (error) {
        console.error("Error fetching trending:", error);
    }
}

// --- NEW: Render Trending Movies ---
function renderTrending() {
    const trendingGrid = document.getElementById("trending-grid");
    if (!trendingGrid) return;

    trendingGrid.innerHTML = "";

    trendingResults.forEach(movie => {
        trendingGrid.appendChild(createMovieCardElement(movie));
    });
}

// --- Fetch Recommendations ---
async function getRecommendations(page = 1) {
    currentApiPage = page;
    const genres = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(el => el.value);

    // FIX: Filter out empty strings so we don't send [""] to the backend
    const actors = document.getElementById('actors').value.split(',').map(a => a.trim()).filter(a => a !== "");
    const movies = document.getElementById('movies').value.split(',').map(m => m.trim()).filter(m => m !== "");

    document.getElementById("results-section").style.display = "block";
    document.getElementById("results").innerHTML = "<p>Loading...</p>";

    // ... (rest of the function remains the same)
}

// --- Fetch AI Vibe Recommendations ---
async function getVibeRecommendations() {
    const vibeText = document.getElementById('vibe-input').value.trim();
    if (!vibeText) return alert("Please enter a vibe first!");

    const resultsSection = document.getElementById("results-section");
    const container = document.getElementById("results");

    resultsSection.style.display = "block";
    container.innerHTML = `<p style="color: var(--accent-red); grid-column: 1 / -1; text-align: center;">
        <i class="fas fa-spinner fa-spin"></i> Our AI is searching the multiverse for your perfect match...
    </p>`;

    resultsSection.scrollIntoView({ behavior: "smooth" });

    try {
        const response = await fetch("/api/vibe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vibe: vibeText })
        });

        const data = await response.json();

        // FIX: Properly display the error on the screen if the AI fails
        if (data.error) {
            container.innerHTML = `<p style="color:red; grid-column: 1 / -1; text-align: center;">${data.error}</p>`;
            return;
        }

        container.innerHTML = "";
        data.forEach(m => {
            container.appendChild(createDetailedMovieCard(m));
        });

        document.getElementById("pagination").innerHTML = "";

    } catch (error) {
        container.innerHTML = `<p style="color:red; grid-column: 1 / -1; text-align: center;">Network error. Could not reach the AI.</p>`;
    }
}

// --- Render Discovery Results ---
function renderResults() {
    const container = document.getElementById("results");
    container.innerHTML = "";

    if (!Array.isArray(lastResults) || lastResults.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted);">No results found for this page.</p>`;
        updatePaginationUI(true);
        return;
    }

    lastResults.forEach(m => {
        container.appendChild(createDetailedMovieCard(m));
    });

    updatePaginationUI(false);
}

function updatePaginationUI(isEmpty) {
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = `
        <button class="pagination-btn" ${currentApiPage === 1 ? "disabled" : ""} onclick="prevPage()">Prev</button>
        <span>Page ${currentApiPage}</span>
        <button class="pagination-btn" ${isEmpty ? "disabled" : ""} onclick="nextPage()">Next</button>
    `;
}

function nextPage() {
    getRecommendations(currentApiPage + 1);
}

function prevPage() {
    if (currentApiPage > 1) {
        getRecommendations(currentApiPage - 1);
    }
}

// --- Watchlist State Management ---
function toggleWatchlist(title) {
    // Now it checks Search Results, Trending Results, AND the Watchlist!
    const movie = lastResults.find(m => m.title === title) ||
        trendingResults.find(m => m.title === title) ||
        watchlist.find(m => m.title === title);

    if (!movie) return;

    const index = watchlist.findIndex(m => m.title === title);

    if (index !== -1) {
        watchlist.splice(index, 1);
    } else {
        watchlist.push(movie);
    }

    localStorage.setItem('myWatchlist', JSON.stringify(watchlist));

    // Update all UI sections immediately
    renderWatchlist();
    renderTrending();
    if (document.getElementById("results-section").style.display !== "none") {
        renderResults();
    }
}

function renderWatchlist() {
    const container = document.getElementById("watchlist-results");
    if (!container) return;

    if (watchlist.length === 0) {
        container.innerHTML = "<p style='color: var(--text-muted); grid-column: 1 / -1;'>Your watchlist is empty. Add some movies to get started!</p>";
        return;
    }

    container.innerHTML = "";
    watchlist.forEach(m => {
        container.appendChild(createDetailedMovieCard(m));
    });
}

// --- Helper: Create Trending Movie Cards ---
function createMovieCardElement(movie) {
    const posterUrl = movie.poster ? movie.poster : 'https://via.placeholder.com/300x450/121216/ffffff?text=No+Poster';
    const year = movie.release_date && movie.release_date !== "N/A" ? movie.release_date.split('-')[0] : '';
    const safeTitle = movie.title.replace(/'/g, "\\'");

    // Check if the movie is already in the watchlist
    const isInWatchlist = watchlist.some(w => w.title === movie.title);
    const btnText = isInWatchlist ? "❌ Remove" : "🔖 Add to Watchlist";
    const btnClass = isInWatchlist ? "remove-btn" : "add-btn";

    const card = document.createElement("div");
    card.className = "movie-card";

    // We add a tiny bit of margin-top to the button to push it to the bottom of the card
    card.innerHTML = `
        <img src="${posterUrl}" alt="${movie.title}">
        <div class="card-body">
            <h4>${movie.title}</h4>
            <div class="card-meta">
                <span>⭐ ${movie.rating ? movie.rating.toFixed(1) : 'NR'}</span>
                <span>${year}</span>
            </div>
            <button class="watchlist-btn ${btnClass}" onclick="toggleWatchlist('${safeTitle}')" style="margin-top: 15px;">${btnText}</button>
        </div>
    `;
    return card;
}

function createDetailedMovieCard(m) {
    const safeTitle = m.title.replace(/'/g, "\\'");
    const posterSrc = m.poster ? m.poster : "https://via.placeholder.com/500x750/172a45/ccd6f6?text=No+Poster";

    const isInWatchlist = watchlist.some(w => w.title === m.title);
    const btnText = isInWatchlist ? "❌ Remove" : "🔖 Add to Watchlist";
    const btnClass = isInWatchlist ? "remove-btn" : "add-btn";

    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
      <img src="${posterSrc}" alt="${m.title}">
      <div class="card-body">
          <h4>${m.title}</h4>
          <div class="card-meta">
              <span>⭐ ${m.rating ? m.rating.toFixed(1) : 'NR'}</span>
              <span>${m.release_date ? m.release_date.split('-')[0] : 'N/A'}</span>
          </div>
     <p class="overview" style="${m.ai_reason ? 'color: #e2e8f0; font-weight: 600;' : ''}">
    ${m.ai_reason ? '✨ ' + m.ai_reason : m.overview}
</p>
    `;
    return card;
}
