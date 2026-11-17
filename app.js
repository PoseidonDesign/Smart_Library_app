"use strict";

const STORAGE_KEY = "smart-library.books.v1";
const STATUSES = ["DISPONIBLE", "EMPRUNTE"];

const elements = {
  form: document.getElementById("book-form"),
  title: document.getElementById("title"),
  author: document.getElementById("author"),
  category: document.getElementById("category"),
  isbn: document.getElementById("isbn"),
  formMessage: document.getElementById("form-message"),
  notice: document.getElementById("app-notice"),
  list: document.getElementById("book-list"),
  emptyLibrary: document.getElementById("empty-library"),
  noResults: document.getElementById("no-results"),
  search: document.getElementById("search-input"),
  statusFilter: document.getElementById("status-filter"),
  categoryFilter: document.getElementById("category-filter"),
  categorySuggestions: document.getElementById("category-suggestions"),
  sortOrder: document.getElementById("sort-order"),
  visibleCount: document.getElementById("visible-count"),
  totalBooks: document.getElementById("total-books"),
  availableBooks: document.getElementById("available-books"),
  borrowedBooks: document.getElementById("borrowed-books"),
  clearFilters: document.getElementById("clear-filters"),
  noResultsClear: document.getElementById("no-results-clear"),
  emptyAddButton: document.getElementById("empty-add-button")
};

const state = {
  books: [],
  storageReady: false
};

function isValidBook(book) {
  return Boolean(
    book &&
    typeof book.id === "string" &&
    book.id.trim() &&
    typeof book.title === "string" &&
    book.title.trim() &&
    typeof book.author === "string" &&
    book.author.trim() &&
    typeof book.category === "string" &&
    book.category.trim() &&
    (book.isbn === null || typeof book.isbn === "string") &&
    typeof book.addedAt === "string" &&
    !Number.isNaN(Date.parse(book.addedAt)) &&
    STATUSES.includes(book.status)
  );
}

function loadBooks() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === null) {
    return [];
  }

  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed) || !parsed.every(isValidBook)) {
    throw new Error("Les données enregistrées ne correspondent pas au format attendu.");
  }

  return parsed.map((book) => ({
    id: book.id,
    title: book.title.trim(),
    author: book.author.trim(),
    isbn: book.isbn ? book.isbn.trim() : null,
    category: book.category.trim(),
    addedAt: book.addedAt,
    status: book.status
  }));
}

function saveBooks(books) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function showNotice(message) {
  elements.notice.textContent = message;
  elements.notice.hidden = false;
}

function hideNotice() {
  elements.notice.textContent = "";
  elements.notice.hidden = true;
}

function setFormMessage(message) {
  elements.formMessage.textContent = message;
}

function createBookId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `book-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeIsbn(isbn) {
  return isbn.replace(/[\s-]/g, "").toUpperCase();
}

function isValidIsbn(isbn) {
  const normalized = normalizeIsbn(isbn);
  return /^(?:\d{9}[\dX]|\d{13})$/.test(normalized);
}

function commitBooks(nextBooks) {
  try {
    saveBooks(nextBooks);
  } catch (error) {
    showNotice("Impossible d’enregistrer les changements dans ce navigateur. Vérifiez que le stockage local est disponible, puis réessayez.");
    return false;
  }

  state.books = nextBooks;
  hideNotice();
  render();
  return true;
}

function compareText(left, right) {
  return left.localeCompare(right, "fr", { sensitivity: "base" });
}

function sortBooks(books) {
  const sorted = [...books];
  switch (elements.sortOrder.value) {
    case "oldest":
      sorted.sort((a, b) => Date.parse(a.addedAt) - Date.parse(b.addedAt));
      break;
    case "title":
      sorted.sort((a, b) => compareText(a.title, b.title));
      break;
    case "author":
      sorted.sort((a, b) => compareText(a.author, b.author));
      break;
    case "newest":
    default:
      sorted.sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt));
      break;
  }
  return sorted;
}

function getVisibleBooks() {
  const query = elements.search.value.trim().toLocaleLowerCase("fr");
  const status = elements.statusFilter.value;
  const category = elements.categoryFilter.value;

  return sortBooks(state.books.filter((book) => {
    const matchesQuery = !query || [book.title, book.author, book.isbn || "", book.category]
      .some((value) => value.toLocaleLowerCase("fr").includes(query));
    const matchesStatus = status === "all" || book.status === status;
    const matchesCategory = category === "all" || book.category === category;
    return matchesQuery && matchesStatus && matchesCategory;
  }));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "book-card";
  card.setAttribute("role", "listitem");

  const top = document.createElement("div");
  top.className = "book-card-top";
  top.append(createTextElement("span", "category-chip", book.category));

  const isBorrowed = book.status === "EMPRUNTE";
  const statusLabel = createTextElement(
    "span",
    `status-chip${isBorrowed ? " is-borrowed" : ""}`,
    isBorrowed ? "EMPRUNTÉ" : "DISPONIBLE"
  );
  statusLabel.setAttribute("aria-label", `Statut : ${isBorrowed ? "emprunté" : "disponible"}`);
  top.append(statusLabel);

  const title = createTextElement("h3", "book-title", book.title);
  const author = createTextElement("p", "book-author", `par ${book.author}`);
  const details = document.createElement("p");
  details.className = "book-details";
  details.append(createTextElement("span", "", `Ajouté le ${formatDate(book.addedAt)}`));
  if (book.isbn) {
    details.append(createTextElement("span", "", `ISBN ${book.isbn}`));
  }

  const actions = document.createElement("div");
  actions.className = "book-actions";
  const statusButton = document.createElement("button");
  statusButton.className = "book-action";
  statusButton.type = "button";
  statusButton.textContent = isBorrowed ? "Retourner" : "Emprunter";
  statusButton.setAttribute(
    "aria-label",
    `${isBorrowed ? "Retourner" : "Emprunter"} « ${book.title} »`
  );
  statusButton.addEventListener("click", () => toggleBookStatus(book.id));

  const deleteButton = document.createElement("button");
  deleteButton.className = "book-delete";
  deleteButton.type = "button";
  deleteButton.textContent = "Supprimer";
  deleteButton.setAttribute("aria-label", `Supprimer « ${book.title} »`);
  deleteButton.addEventListener("click", () => deleteBook(book.id));

  actions.append(statusButton, deleteButton);
  card.append(top, title, author, details, actions);
  return card;
}

function updateCategoryOptions() {
  const selectedFilter = elements.categoryFilter.value;
  const categories = [...new Set(state.books.map((book) => book.category))]
    .sort(compareText);

  elements.categoryFilter.replaceChildren(new Option("Toutes les catégories", "all"));
  categories.forEach((category) => {
    elements.categoryFilter.append(new Option(category, category));
  });
  elements.categorySuggestions.replaceChildren(
    ...categories.map((category) => new Option(category))
  );

  elements.categoryFilter.value = categories.includes(selectedFilter) ? selectedFilter : "all";
}

function updateCounters() {
  const available = state.books.filter((book) => book.status === "DISPONIBLE").length;
  const borrowed = state.books.length - available;
  elements.totalBooks.textContent = String(state.books.length);
  elements.availableBooks.textContent = String(available);
  elements.borrowedBooks.textContent = String(borrowed);
}

function render() {
  updateCounters();
  updateCategoryOptions();

  if (!state.storageReady) {
    elements.list.replaceChildren();
    elements.emptyLibrary.hidden = true;
    elements.noResults.hidden = true;
    elements.visibleCount.textContent = "Indisponible";
    return;
  }

  const visibleBooks = getVisibleBooks();
  elements.list.replaceChildren(...visibleBooks.map(createBookCard));
  elements.visibleCount.textContent = `${visibleBooks.length} ${visibleBooks.length === 1 ? "livre" : "livres"}`;
  elements.emptyLibrary.hidden = state.books.length !== 0;
  elements.noResults.hidden = state.books.length === 0 || visibleBooks.length !== 0;
}

function clearFilters() {
  elements.search.value = "";
  elements.statusFilter.value = "all";
  elements.categoryFilter.value = "all";
  elements.sortOrder.value = "newest";
  render();
}

function toggleBookStatus(id) {
  const nextBooks = state.books.map((book) => {
    if (book.id !== id) {
      return book;
    }
    return {
      ...book,
      status: book.status === "DISPONIBLE" ? "EMPRUNTE" : "DISPONIBLE"
    };
  });
  commitBooks(nextBooks);
}

function deleteBook(id) {
  const book = state.books.find((item) => item.id === id);
  if (!book || !window.confirm(`Supprimer « ${book.title} » de votre bibliothèque ?`)) {
    return;
  }
  commitBooks(state.books.filter((item) => item.id !== id));
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  setFormMessage("");

  const title = elements.title.value.trim();
  const author = elements.author.value.trim();
  const category = elements.category.value.trim();
  const isbnInput = elements.isbn.value.trim();

  if (!title || !author || !category) {
    setFormMessage("Le titre, l’auteur et la catégorie sont obligatoires.");
    return;
  }

  if (isbnInput && !isValidIsbn(isbnInput)) {
    setFormMessage("Saisissez un ISBN-10 ou ISBN-13 valide, ou laissez ce champ vide.");
    elements.isbn.focus();
    return;
  }

  if (isbnInput) {
    const normalizedIsbn = normalizeIsbn(isbnInput);
    const duplicate = state.books.some((book) =>
      book.isbn && normalizeIsbn(book.isbn) === normalizedIsbn
    );
    if (duplicate && !window.confirm("Un livre avec cet ISBN existe déjà. Voulez-vous tout de même ajouter cet exemplaire ?")) {
      return;
    }
  }

  const newBook = {
    id: createBookId(),
    title,
    author,
    isbn: isbnInput || null,
    category,
    addedAt: new Date().toISOString(),
    status: "DISPONIBLE"
  };

  if (commitBooks([newBook, ...state.books])) {
    elements.form.reset();
    setFormMessage("");
    elements.title.focus();
  }
});

elements.search.addEventListener("input", render);
elements.statusFilter.addEventListener("change", render);
elements.categoryFilter.addEventListener("change", render);
elements.sortOrder.addEventListener("change", render);
elements.clearFilters.addEventListener("click", clearFilters);
elements.noResultsClear.addEventListener("click", clearFilters);
elements.emptyAddButton.addEventListener("click", () => elements.title.focus());

try {
  state.books = loadBooks();
  state.storageReady = true;
} catch (error) {
  showNotice("Impossible de lire les données de la bibliothèque. Elles n’ont pas été modifiées. Vérifiez le stockage local de votre navigateur.");
  document.querySelectorAll("input, select, form button").forEach((control) => {
    control.disabled = true;
  });
}

render();