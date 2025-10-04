let currentPage = 1;
let lastResults = [];

async function getRecommendations(page = 1) {
    const genres = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(el => el.value);
    const actors = document.getElementById('actors').value.split(',').map(a => a.trim());
    const movies = document.getElementById('movies').value.split(',').map(m => m.trim());

    const response = await fetch("/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genres, actors, movies, page })
    });

    const data = await response.json();

    // ✅ Handle API error (backend sent object with error)
    if (!Array.isArray(data)) {
        document.getElementById("results").innerHTML =
            `<p style="color:red;">${data.error || "Something went wrong."}</p>`;
        return;
    }

    lastResults = data;
    currentPage = 1;
    renderPage(currentPage);
}

function renderPage(page) {
    const resultsPerPage = 6;
    const start = (page - 1) * resultsPerPage;
    const end = start + resultsPerPage;

    // ✅ Make sure lastResults is an array
    if (!Array.isArray(lastResults)) {
        document.getElementById("results").innerHTML =
            `<p style="color:red;">No results to show.</p>`;
        return;
    }

    const movies = lastResults.slice(start, end);
    const container = document.getElementById("results");
    container.innerHTML = "";

    movies.forEach(m => {
        const card = document.createElement("div");
        card.className = "movie-card";
        card.innerHTML = `
      <img src="${m.poster || ''}" alt="${m.title}">
      <h3>${m.title}</h3>
      <p>⭐ ${m.rating}</p>
      <p>${m.release_date}</p>
      <p>${m.overview}</p>
    `;
        container.appendChild(card);
    });

    // Pagination buttons
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = `
    <button ${page === 1 ? "disabled" : ""} onclick="prevPage()">Prev</button>
    <span>Page ${page}</span>
    <button ${end >= lastResults.length ? "disabled" : ""} onclick="nextPage()">Next</button>
  `;
}

function nextPage() {
    if ((currentPage * 6) < lastResults.length) {
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
