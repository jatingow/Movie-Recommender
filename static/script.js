let currentPage = 1;
let lastResults = [];

// --- Execute on Page Load ---
document.addEventListener("DOMContentLoaded", () => {
    fetchTrendingMovies();
});

// --- Fetch Trending Movies ---
async function fetchTrendingMovies() {
    try {
        const response = await fetch("/api/trending");
        const data = await response.json();

        const trendingGrid = document.getElementById("trending-grid");
        trendingGrid.innerHTML = "";

        if (Array.isArray(data) && data.length > 0) {
            data.forEach(movie => {
                trendingGrid.appendChild(createMovieCardElement(movie, "Trending"));
            });
        } else {
            trendingGrid.innerHTML = `<p style="color:red;">Could not load trending movies.</p>`;
        }
    } catch (error) {
        console.error("Error fetching trending:", error);
    }
}

// --- Fetch Recommendations ---
async function getRecommendations(page = 1) {
    const genres = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(el => el.value);
    const actors = document.getElementById('actors').value.split(',').map(a => a.trim());
    const movies = document.getElementById('movies').value.split(',').map(m => m.trim());

    // Show the results section
    document.getElementById("results-section").style.display = "block";
    document.getElementById("results").innerHTML = "<p>Loading...</p>";

    const response = await fetch("/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres, actors, movies, page })
    });

    const data = await response.json();

    if (!Array.isArray(data)) {
        document.getElementById("results").innerHTML =
            `<p style="color:red;">${data.error || "Something went wrong."}</p>`;
        return;
    }

    lastResults = data;
    currentPage = 1;
    renderPage(currentPage);

    // Smooth scroll down to results
    document.getElementById("results-section").scrollIntoView({ behavior: "smooth" });
}

// --- Render Recommendation Pagination ---
function renderPage(page) {
    const resultsPerPage = 12; // Increased to fill the grid better
    const start = (page - 1) * resultsPerPage;
    const end = start + resultsPerPage;

    if (!Array.isArray(lastResults)) {
        document.getElementById("results").innerHTML = `<p style="color:red;">No results to show.</p>`;
        return;
    }

    const movies = lastResults.slice(start, end);
    const container = document.getElementById("results");
    container.innerHTML = "";

    movies.forEach(m => {
        container.appendChild(createMovieCardElement(m, "Recommended"));
    });

    const pagination = document.getElementById("pagination");
    pagination.innerHTML = `
        <button ${page === 1 ? "disabled" : ""} onclick="prevPage()">Prev</button>
        <span>Page ${page}</span>
        <button ${end >= lastResults.length ? "disabled" : ""} onclick="nextPage()">Next</button>
    `;
}

function nextPage() {
    if ((currentPage * 12) < lastResults.length) {
        currentPage++;
        renderPage(currentPage);
    }
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPage(currentPage);
    }
}

// --- Helper: Create consistent movie cards ---
function createMovieCardElement(movie, subtitleTag) {
    const posterUrl = movie.poster ? movie.poster : 'https://via.placeholder.com/300x450/121216/ffffff?text=No+Poster';
    const year = movie.release_date && movie.release_date !== "N/A" ? movie.release_date.split('-')[0] : '';

    // Format the subtitle under the title (e.g., "Movie • 2026")
    let subtitleText = "Movie";
    if (year) subtitleText += ` • ${year}`;

    const card = document.createElement("div");
    card.className = "movie-card";
    card.innerHTML = `
        <div class="movie-poster-container">
            <img src="${posterUrl}" alt="${movie.title}">
        </div>
        <div class="movie-info">
            <h4>${movie.title}</h4>
            <p>${subtitleText}</p>
        </div>
    `;
    return card;
}