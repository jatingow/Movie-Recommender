from flask import Flask, render_template, request, jsonify
import requests
import google.generativeai as genai
import json
import os

app = Flask(__name__)

# ---------- API Keys & Config ---------- #
API_KEY = "271274173a33097a96c2c6e7495bec0e"  # TMDB API key
BASE_URL = "https://api.themoviedb.org/3"

GEMINI_API_KEY = "AIzaSyCdX3SIi1LBbUQ64quQn6qCXRx1njL7Ht0" # Gemini API key
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash') 

# ---------- Safe Request Function ---------- #
def safe_request(url, params=None):
    try:
        response = requests.get(url, params=params, timeout=8)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"⚠️ API connection error: {e}")
        return {} 

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

@app.route('/api/trending', methods=['GET'])
def get_trending():
    """Fetches the trending movies of the week for the Talk of the Town section."""
    url = f"{BASE_URL}/trending/movie/week"
    data = safe_request(url, {"api_key": API_KEY})
    return jsonify(format_movie_results(data)[:12])

@app.route('/recommend', methods=['POST'])
def recommend_movies():
    try:
        data = request.get_json()
        genres = data.get("genres", [])
        
        # FIX: Strip out empty strings from the inputs so we don't confuse TMDB
        actors = [a.strip() for a in data.get("actors", []) if a.strip()]
        movies = [m.strip() for m in data.get("movies", []) if m.strip()]
        page = int(data.get("page", 1))

        actor_ids = [search_actor(a) for a in actors]
        actor_ids = [a for a in actor_ids if a] # Remove any Nones

        all_results = []

        if genres or actor_ids:
            all_results.extend(discover_movies(genres=genres, actors=actor_ids, page=page))

        for movie in movies:
            mid = search_movie(movie)
            if mid:
                all_results.extend(get_similar_movies(mid, page=page))

        if not all_results:
            return jsonify({"error": "Could not fetch recommendations."}), 200

        seen = set()
        unique_results = []
        for r in all_results:
            if r["title"] not in seen:
                seen.add(r["title"])
                unique_results.append(r)

        return jsonify(unique_results[:18])

    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/vibe', methods=['POST'])
def vibe_search():
    data = request.get_json()
    vibe_prompt = data.get("vibe", "").strip()

    if not vibe_prompt:
        return jsonify({"error": "Please enter a vibe."}), 400

    try:
        # 1. Let the AI use its full brain to pick movies, NOT a limited list.
        prompt = f"""
        You are an expert movie curator. The user wants movies with this vibe/description: "{vibe_prompt}"
        
        Recommend exactly 6 movies that perfectly match.
        Return ONLY a raw JSON array. Do NOT wrap it in markdown formatting like ```json.
        Each object must have exactly two keys:
        "title": "The exact official movie title",
        "ai_reason": "A 1-sentence personalized explanation of why it fits."
        """

        response = model.generate_content(prompt)
        
        # 2. Robust JSON cleanup to prevent the crash you experienced
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[-1]
        if raw_text.endswith("```"):
            raw_text = raw_text.rsplit("\n", 1)[0]
        raw_text = raw_text.replace("json", "", 1).strip()
        
        try:
            ai_recommendations = json.loads(raw_text)
        except json.JSONDecodeError:
            print(f"Failed to parse: {raw_text}")
            return jsonify({"error": "AI returned an unreadable format. Please try again."}), 500

        # 3. Fetch real TMDB data for these AI-selected movies
        final_results = []
        for rec in ai_recommendations:
            url = f"{BASE_URL}/search/movie"
            # Search TMDB for the exact title the AI generated
            tmdb_data = safe_request(url, {"api_key": API_KEY, "query": rec["title"]})
            
            if tmdb_data and tmdb_data.get("results"):
                m = tmdb_data["results"][0] # Take the top match
                poster = f"[https://image.tmdb.org/t/p/w500](https://image.tmdb.org/t/p/w500){m['poster_path']}" if m.get("poster_path") else ""
                final_results.append({
                    "title": m.get("title", rec["title"]),
                    "overview": m.get("overview", "No description available."),
                    "poster": poster,
                    "release_date": m.get("release_date", "N/A"),
                    "rating": m.get("vote_average", 0),
                    "ai_reason": rec.get("ai_reason", "")
                })

        if not final_results:
            return jsonify({"error": "Could not find those movies in the database."}), 404

        return jsonify(final_results)

    except Exception as e:
        print(f"⚠️ AI Error: {e}")
        return jsonify({"error": "The AI curator is currently resting. Try again!"}), 500
# ---------- App Execution ---------- #
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)