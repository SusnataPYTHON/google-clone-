    <script>
        // Environment variables required for fetch calls in this sandbox
        const __app_id = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const __firebase_config = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
        const __initial_auth_token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
        
        const API_MODEL = "gemini-2.5-flash-preview-05-20";
        // API_URL will be completed with the API key by the sandbox environment
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent?key=`;

        const searchInput = document.getElementById('main-in');
        const searchForm = document.getElementById('search-form');
        const luckyBtn = document.getElementById('lucky-btn');
        const suggestionsDropdown = document.getElementById('suggestions-dropdown');
        const loadingIndicator = document.getElementById('loading-indicator');

        // --- Core Search Functionality ---

        /**
         * Redirects the user to the real Google search results page.
         * @param {string} query The search term.
         * @param {boolean} isLucky Whether to use the "I'm Feeling Lucky" redirect.
         */
        const executeGoogleSearch = (query, isLucky = false) => {
            if (query) {
                const encodedQuery = encodeURIComponent(query);
                let searchUrl = `https://www.google.com/search?q=${encodedQuery}`;
                
                if (isLucky) {
                    searchUrl = `https://www.google.com/search?btnI=I&q=${encodedQuery}`;
                }
                
                // Perform the redirect
                window.location.href = searchUrl; 
            }
        };

        /**
         * Handles the form submission (Google Search button or Enter key).
         */
        function handleSearch(event) {
            event.preventDefault(); 
            const query = searchInput.value.trim();
            executeGoogleSearch(query, false);
        }
        
        // Attach event listener for form submission
        searchForm.addEventListener('submit', handleSearch);

        // Attach event listener for "I'm Feeling Lucky" button
        luckyBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            executeGoogleSearch(query, true);
        });


        // --- Search Suggestion Logic (using Gemini API) ---

        let debounceTimer;
        const MAX_RETRIES = 3;

        /** Clears and hides the suggestions dropdown. */
        const hideSuggestions = () => {
            suggestionsDropdown.classList.remove('show');
            suggestionsDropdown.innerHTML = '';
        };

        /**
         * Displays the suggestions in the dropdown list.
         * @param {string[]} suggestions Array of suggested search terms.
         */
        const showSuggestions = (suggestions) => {
            suggestionsDropdown.innerHTML = '';
            suggestions.forEach(suggestion => {
                const li = document.createElement('li');
                li.textContent = suggestion;
                
                // Clicking a suggestion fills the input and performs the search
                li.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent document click from immediately hiding
                    searchInput.value = suggestion;
                    executeGoogleSearch(suggestion, false);
                    hideSuggestions();
                });
                suggestionsDropdown.appendChild(li);
            });
            
            if (suggestions.length > 0) {
                suggestionsDropdown.classList.add('show');
            } else {
                hideSuggestions();
            }
        };

        /**
         * Calls the Gemini API to get search suggestions using search grounding.
         * Implements exponential backoff for reliability.
         * @param {string} query The partial search query.
         * @param {number} attempt The current retry attempt number.
         */
        async function fetchSuggestions(query, attempt = 1) {
            loadingIndicator.style.display = 'block';

            const systemPrompt = "You are a fast, responsive search suggestion engine. Your task is to provide exactly 5 short, relevant search term suggestions based on the user's partial query. Format the output as a simple, unnumbered list of suggested terms, one term per line, with no extra commentary or markdown formatting.";
            const userQuery = `Based on this partial search query: "${query}", generate a list of 5 possible real-world search suggestions.`;

            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }], // Enable real-time grounding
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            try {
                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    throw new Error(`API returned status ${response.status}`);
                }

                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
                
                // Process the raw text output into an array of suggestions
                const suggestions = text
                    .split('\n')
                    .map(s => s.trim())
                    .filter(s => s.length > 0 && s !== ' ');
                
                showSuggestions(suggestions);

            } catch (error) {
                if (attempt < MAX_RETRIES) {
                    const delay = Math.pow(2, attempt) * 1000; 
                    setTimeout(() => fetchSuggestions(query, attempt + 1), delay);
                } else {
                    hideSuggestions();
                    console.error("Failed to fetch suggestions after multiple retries.");
                }

            } finally {
                // Ensure loading indicator is hidden after the last attempt
                if (attempt >= MAX_RETRIES || (suggestionsDropdown.classList.contains('show'))) {
                    loadingIndicator.style.display = 'none';
                }
            }
        }

        /** Debounces the suggestion fetching to limit API calls on rapid typing. */
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim();
            
            clearTimeout(debounceTimer); 
            
            if (query.length > 2) {
                // Wait 300ms after the last keypress before calling the API
                debounceTimer = setTimeout(() => {
                    fetchSuggestions(query);
                }, 300);
            } else {
                hideSuggestions();
            }
        });

        // Hide suggestions when clicking anywhere outside the input area
        document.addEventListener('click', (event) => {
            if (!document.getElementById('input-wrapper').contains(event.target)) {
                hideSuggestions();
            }
        });

    </script>