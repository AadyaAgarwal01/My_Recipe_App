(() => {
  const favoritesKey = "favorites";
  let favorites = JSON.parse(localStorage.getItem(favoritesKey) || "[]");
  let currentCategory = null;
  let debounceTimeout = null;
  const cardsContainer = document.getElementById("cards");
  const categoryBar = document.getElementById("category-bar");
  const favCountElem = document.getElementById("fav-count");
  const modalRoot = document.getElementById("modal-root");
  const favModalRoot = document.getElementById("fav-modal-root");
  const themeToggleBtn = document.getElementById("theme-toggle");

  function setTheme(dark) {
    document.body.setAttribute("data-theme", dark ? "dark" : "light");
    themeToggleBtn.innerHTML = dark
      ? '<img src="light.png" alt="" width="32" height="32" />'
      : '<img src="dark.png" alt="" width="32" height="32" />';
    localStorage.setItem("darkMode", dark);
  }
  themeToggleBtn.onclick = () =>
    setTheme(document.body.getAttribute("data-theme") !== "dark");
  setTheme(localStorage.getItem("darkMode") === "true");

  async function fetchCategories() {
    const res = await fetch(
      "https://www.themealdb.com/api/json/v1/1/categories.php"
    );
    const data = await res.json();
    renderCategories(data.categories || []);
  }
  function renderCategories(categories) {
    categoryBar.innerHTML = "";
    categories.forEach((cat, i) => {
      const btn = document.createElement("button");
      btn.className = "category-btn";
      btn.textContent = cat.strCategory;
      btn.title = cat.strCategoryDescription;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", "false");
      btn.setAttribute("tabindex", "-1");
      btn.onclick = () => {
        Array.from(categoryBar.children).forEach((b) => {
          b.classList.remove("selected");
          b.setAttribute("aria-selected", "false");
          b.setAttribute("tabindex", "-1");
        });
        btn.classList.add("selected");
        btn.setAttribute("aria-selected", "true");
        btn.setAttribute("tabindex", "0");
        btn.focus();
        currentCategory = cat.strCategory;
        fetchRecipesByCategory(cat.strCategory);
      };
      if (i === 0) {
        btn.classList.add("selected");
        btn.setAttribute("aria-selected", "true");
        btn.setAttribute("tabindex", "0");
        currentCategory = cat.strCategory;
      }
      categoryBar.appendChild(btn);
    });
    if (currentCategory) fetchRecipesByCategory(currentCategory);
  }

  async function fetchRecipesByCategory(category) {
    clearSearchInput();
    showLoading(true);
    const res = await fetch(
      `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(
        category
      )}`
    );
    const data = await res.json();
    const meals = await Promise.all(
      (data.meals || []).slice(0, 12).map(async (m) => {
        try {
          const detailRes = await fetch(
            `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${m.idMeal}`
          );
          const detailData = await detailRes.json();
          const meal = detailData.meals?.[0];

          if (meal && meal.strMeal && meal.strMealThumb) {
            return meal;
          } else {
            console.warn("Meal is undefined or missing info:", m.idMeal);
            return null;
          }
        } catch (err) {
          console.error("Failed to fetch meal detail:", err);
          return null;
        }
      })
    );

    renderCards(meals.filter(Boolean));
    showLoading(false);
    scrollToTop();
  }

  async function fetchRecipes(keyword = "chicken") {
    currentCategory = null;
    Array.from(categoryBar.children).forEach((b) =>
      b.classList.remove("selected")
    );
    showLoading(true);
    const res = await fetch(
      `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(
        keyword
      )}`
    );
    const data = await res.json();
    renderCards((data.meals || []).filter(Boolean));
    showLoading(false);
    scrollToTop();
  }

  function clearSearchInput() {
    const input = document.getElementById("searchInput");
    input.value = "";
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function getIngredients(meal, max = 5) {
    const ings = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      if (ing && ing.trim()) ings.push(ing.trim());
      if (ings.length === max) break;
    }
    return ings;
  }

  function isFavorite(id) {
    return favorites.includes(id);
  }

  function toggleFavorite(meal) {
    const idx = favorites.indexOf(meal.idMeal);
    if (idx === -1) {
      favorites.push(meal.idMeal);
    } else {
      favorites.splice(idx, 1);
    }
    localStorage.setItem(favoritesKey, JSON.stringify(favorites));
    updateFavCount();
  }

  function updateFavCount() {
    favCountElem.textContent = favorites.length;
  }

  function showLoading(show) {
    if (show) {
      if (!cardsContainer.querySelector(".loading-spinner")) {
        const spinner = document.createElement("div");
        spinner.className = "loading-spinner";
        spinner.innerHTML = '<i class="fa-solid fa-utensils fa-spin"></i>';
        cardsContainer.appendChild(spinner);
      }
    } else {
      const spinner = cardsContainer.querySelector(".loading-spinner");
      if (spinner) spinner.remove();
    }
  }

  function renderCards(meals) {
    cardsContainer.setAttribute("aria-busy", "true");
    cardsContainer.innerHTML = "";
    if (meals.length === 0) {
      cardsContainer.innerHTML =
        '<div class="no-results" role="alert">No recipes found.</div>';
      cardsContainer.setAttribute("aria-busy", "false");
      return;
    }
    meals.forEach((meal) => {
      if (!meal.strMeal || !meal.strMealThumb) {
        console.warn("Skipping invalid meal:", meal);
        return;
      }

      const ings = getIngredients(meal, 5);
      const ingIcons = ings
        .map(
          (ing) => `
            <div class="ingredient-icon">
              <img src="https://www.themealdb.com/images/ingredients/${encodeURIComponent(
                ing
              )}.png" alt="${ing}">
              <span>${ing}</span>
            </div>
          `
        )
        .join("");
      const card = document.createElement("div");
      card.className = "card";
      card.tabIndex = 0;
      card.setAttribute("role", "article");
      card.setAttribute("aria-label", meal.strMeal);
      card.innerHTML = `
            <img class="card-img" src="${meal.strMealThumb}" alt="${
        meal.strMeal
      }" loading="lazy" />
            <div class="card-body">
              <div class="card-title">${meal.strMeal}</div>
              <div class="card-meta">${meal.strArea || ""} &middot; ${
        meal.strCategory || ""
      }</div>
              <div class="ingredient-row">${ingIcons}</div>
              <div class="card-footer">
                <button class="view-btn" aria-label="View steps for ${
                  meal.strMeal
                }">View Steps</button>
                <button class="fav-btn ${
                  isFavorite(meal.idMeal) ? "favorited" : ""
                }" aria-label="${
        isFavorite(meal.idMeal) ? "Remove from favorites" : "Add to favorites"
      }" title="Toggle favorite">
                  <i class="${
                    isFavorite(meal.idMeal) ? "fa-solid" : "fa-regular"
                  } fa-heart"></i>
                </button>
              </div>
            </div>
          `;
      card.querySelector(".fav-btn").onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(meal);
        renderCards(meals);
      };
      card.querySelector(".view-btn").onclick = () => openRecipeModal(meal);
      card.onkeypress = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openRecipeModal(meal);
        }
      };
      cardsContainer.appendChild(card);
    });
    cardsContainer.setAttribute("aria-busy", "false");
    updateFavCount();
  }

  function splitInstructions(instr) {
    if (!instr) return [];
    let steps = instr.split(/\r?\n(?=\d+\.)/).filter(Boolean);
    if (steps.length > 1) return steps.map((s) => s.trim());
    steps = instr.split(/\r?\n/).filter((s) => s.trim());
    if (steps.length > 1) return steps.map((s) => s.trim());
    if (instr.includes(". ")) {
      steps = instr
        .split(". ")
        .map((s) => s.trim())
        .filter(Boolean);
      if (steps.length > 1) return steps;
    }
    return [instr.trim()];
  }

  function openRecipeModal(meal) {
    const ings = [];
    for (let i = 1; i <= 20; i++) {
      const ing = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ing && ing.trim()) {
        ings.push({
          ing: ing.trim(),
          measure: measure ? measure.trim() : "",
        });
      }
    }
    const ingIcons = ings
      .map(
        ({ ing, measure }) => `
          <div class="ingredient-icon">
            <img src="https://www.themealdb.com/images/ingredients/${encodeURIComponent(
              ing
            )}.png" alt="${ing}">
            <span>${ing}${
          measure
            ? `<br><span style='color:#aaa;font-size:0.8em;'>${measure}</span>`
            : ""
        }</span>
          </div>
        `
      )
      .join("");
    const steps = splitInstructions(meal.strInstructions);
    modalRoot.innerHTML = `
          <div class="modal-bg" tabindex="-1" role="dialog" aria-modal="true" aria-label="Recipe details for ${
            meal.strMeal
          }">
            <div class="modal">
              <button class="modal-close" aria-label="Close modal">&times;</button>
              <img class="modal-img" src="${meal.strMealThumb}" alt="${
      meal.strMeal
    }" />
              <div class="modal-title">${meal.strMeal}</div>
              <div class="modal-section"><strong>Category:</strong> ${
                meal.strCategory || ""
              } &nbsp; <strong>Area:</strong> ${meal.strArea || ""}</div>
              <div class="modal-section modal-ingredients">${ingIcons}</div>
              <div class="modal-section"><strong>Step-by-step Instructions:</strong>
                <div style="margin-top:8px;">
                  ${steps
                    .map(
                      (step, i) =>
                        `<div class="modal-step"><b>Step ${
                          i + 1
                        }:</b> ${step}</div>`
                    )
                    .join("")}
                </div>
              </div>
              <div class="modal-bottom-row">
                ${
                  meal.strYoutube
                    ? `<a class="modal-youtube" href="${meal.strYoutube}" target="_blank" rel="noopener"><i class="fa-brands fa-youtube"></i> YouTube</a>`
                    : ""
                }
                <button class="modal-fav-btn ${
                  isFavorite(meal.idMeal) ? "favorited" : ""
                }" aria-label="Toggle favorite" title="Toggle favorite">
                  <i class="${
                    isFavorite(meal.idMeal) ? "fa-solid" : "fa-regular"
                  } fa-heart"></i>
                </button>
              </div>
            </div>
          </div>
        `;
    modalRoot.querySelector(".modal-close").onclick = closeRecipeModal;
    modalRoot.querySelector(".modal-bg").onclick = (e) => {
      if (e.target === modalRoot.querySelector(".modal-bg")) closeRecipeModal();
    };
    modalRoot.querySelector(".modal-fav-btn").onclick = (e) => {
      e.stopPropagation();
      toggleFavorite(meal);
      openRecipeModal(meal);
      renderCards(
        Array.from(cardsContainer.children)
          .map((card) => card.mealData)
          .filter(Boolean)
      );
    };
    modalRoot.querySelector(".modal").mealData = meal;
    document.body.style.overflow = "hidden";
    modalRoot.setAttribute("aria-hidden", "false");
  }
  function closeRecipeModal() {
    modalRoot.innerHTML = "";
    document.body.style.overflow = "auto";
    modalRoot.setAttribute("aria-hidden", "true");
  }

  document.getElementById("show-favorites").onclick = async () => {
    if (favorites.length === 0) {
      favModalRoot.innerHTML = `
            <div class="modal-bg" role="dialog" aria-modal="true" aria-label="Favorites">
              <div class="modal fav-modal">
                <button class="modal-close" aria-label="Close modal">&times;</button>
                <h2>Your Favorite Recipes</h2>
                <div class="no-results">No favorites yet. Click <span style="color:#e67e22;"><i class="fa-solid fa-heart"></i></span> on a recipe to add!</div>
              </div>
            </div>
          `;
      favModalRoot.querySelector(".modal-close").onclick = closeFavModal;
      favModalRoot.querySelector(".modal-bg").onclick = (e) => {
        if (e.target === favModalRoot.querySelector(".modal-bg"))
          closeFavModal();
      };
      document.body.style.overflow = "hidden";
      favModalRoot.setAttribute("aria-hidden", "false");
      return;
    }
    const mealsRaw = await Promise.all(
      favorites.map(async (id) => {
        const res = await fetch(
          `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`
        );
        const data = await res.json();
        return data.meals ? data.meals[0] : null;
      })
    );
    const meals = mealsRaw.filter(Boolean);
    favModalRoot.innerHTML = `
          <div class="modal-bg" role="dialog" aria-modal="true" aria-label="Favorites">
            <div class="modal fav-modal">
              <button class="modal-close" aria-label="Close modal">&times;</button>
              <h2>Your Favorite Recipes</h2>
              <div class="grid">
                ${meals
                  .map((meal) => {
                    const ings = getIngredients(meal, 4);
                    const ingIcons = ings
                      .map(
                        (ing) => `
                    <div class="ingredient-icon">
                      <img src="https://www.themealdb.com/images/ingredients/${encodeURIComponent(
                        ing
                      )}.png" alt="${ing}">
                      <span>${ing}</span>
                    </div>
                  `
                      )
                      .join("");
                    return `
                    <div class="card" tabindex="0" role="article" aria-label="${
                      meal.strMeal
                    }">
                      <img class="card-img" src="${meal.strMealThumb}" alt="${
                      meal.strMeal
                    }" loading="lazy" />
                      <div class="card-body">
                        <div class="card-title">${meal.strMeal}</div>
                        <div class="card-meta">${meal.strArea || ""} &middot; ${
                      meal.strCategory || ""
                    }</div>
                        <div class="ingredient-row">${ingIcons}</div>
                        <div class="card-footer">
                          <button class="view-btn" data-id="${
                            meal.idMeal
                          }" aria-label="View steps for ${
                      meal.strMeal
                    }">View Steps</button>
                          <button class="fav-btn favorited" data-id="${
                            meal.idMeal
                          }" aria-label="Remove from favorites" title="Remove from favorites">
                            <i class="fa-solid fa-heart"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        `;
    favModalRoot.querySelectorAll(".fav-btn").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        const idx = favorites.indexOf(id);
        if (idx !== -1) {
          favorites.splice(idx, 1);
          localStorage.setItem("favorites", JSON.stringify(favorites));
          updateFavCount();
          document.getElementById("show-favorites").click();
        }
      };
    });
    favModalRoot.querySelectorAll(".view-btn").forEach((btn) => {
      btn.onclick = async (e) => {
        const id = btn.getAttribute("data-id");
        const res = await fetch(
          `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`
        );
        const data = await res.json();
        if (data.meals && data.meals[0]) openRecipeModal(data.meals[0]);
      };
    });
    favModalRoot.querySelector(".modal-close").onclick = closeFavModal;
    favModalRoot.querySelector(".modal-bg").onclick = (e) => {
      if (e.target === favModalRoot.querySelector(".modal-bg")) closeFavModal();
    };
    document.body.style.overflow = "hidden";
    favModalRoot.setAttribute("aria-hidden", "false");
  };
  function closeFavModal() {
    favModalRoot.innerHTML = "";
    document.body.style.overflow = "auto";
    favModalRoot.setAttribute("aria-hidden", "true");
  }
  const searchInput = document.getElementById("searchInput");
  const searchForm = document.getElementById("searchForm");
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      const val = searchInput.value.trim();
      if (val) fetchRecipes(val);
      else if (currentCategory) fetchRecipesByCategory(currentCategory);
      else fetchRecipes();
    }, 300);
  });

  fetchCategories();
  fetchRecipes();
  updateFavCount();
})();
