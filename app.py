from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)

API_KEY = "271274173a33097a96c2c6e7495bec0e"  # 👈 replace with your TMDB API key
BASE_URL = "https://api.themoviedb.org/3"


# ---------- Safe Request Function ---------- #
def safe_request(url, params=None):
    try:
        response = requests.get(url, params=params, timeout=8)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"⚠️ API connection error: {e}")
        return {}  # return empty JSON if failed


# ---------- Helper Functions ---------- #
def get_genre_list():
    url = f"{BASE_URL}/genre/movie/list"
    data = safe_request(url, {"api_key": API_KEY})
    return data.get("genres", [])


def search_actor(actor_name):
    url = f"{BASE_URL}/search/person"
    data = safe_request(url, {"api_key": API_KEY, "query": actor_name})
    if data.get("results"):
        return data["results"][0]["id"]
    return None


def search_movie(movie_name):
    url = f"{BASE_URL}/search/movie"
    data = safe_request(url, {"api_key": API_KEY, "query": movie_name})
    if data.get("results"):
        return data["results"][0]["id"]
    return None


def discover_movies(genres=None, actors=None, page=1):
    params = {
        "api_key": API_KEY,
        "sort_by": "popularity.desc",
        "page": page
    }
    if genres:
        params["with_genres"] = ",".join(map(str, genres))
    if actors:
        params["with_cast"] = ",".join(map(str, actors))

    data = safe_request(f"{BASE_URL}/discover/movie", params)
    return format_movie_results(data)


def get_similar_movies(movie_id, page=1):
    url = f"{BASE_URL}/movie/{movie_id}/similar"
    data = safe_request(url, {"api_key": API_KEY, "page": page})
    return format_movie_results(data)


def format_movie_results(data):
    results = []
    for m in data.get("results", []):
        poster = f"https://image.tmdb.org/t/p/w500{m['poster_path']}" if m.get("poster_path") else ""
        results.append({
            "title": m.get("title", "Unknown"),
            "overview": m.get("overview", "No description available."),
            "poster": poster,
            "release_date": m.get("release_date", "N/A"),
            "rating": m.get("vote_average", 0)
        })
    return results


# ---------- Routes ---------- #
@app.route('/')
def home():
    genres = get_genre_list() or []
    return render_template('index.html', genres=genres)


@app.route('/recommend', methods=['POST'])
def recommend_movies():
    try:
        data = request.get_json()
        genres = data.get("genres", [])
        actors = data.get("actors", [])
        movies = data.get("movies", [])
        page = int(data.get("page", 1))

        print(f"🎬 Received: genres={genres}, actors={actors}, movies={movies}, page={page}")

        actor_ids = [search_actor(a) for a in actors if a]
        actor_ids = [a for a in actor_ids if a]

        all_results = []

        # Genre + Actor recommendations
        if genres or actor_ids:
            all_results.extend(discover_movies(genres=genres, actors=actor_ids, page=page))

        # Movie-based recommendations
        for movie in movies:
            mid = search_movie(movie)
            if mid:
                all_results.extend(get_similar_movies(mid, page=page))

        if not all_results:
            return jsonify({"error": "Could not fetch recommendations (check API key or internet connection)."}), 200

        # Remove duplicates
        seen = set()
        unique_results = []
        for r in all_results:
            if r["title"] not in seen:
                seen.add(r["title"])
                unique_results.append(r)

        return jsonify(unique_results[:18])

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Server error: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True)
