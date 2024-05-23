import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "booknote",
  password: "nomsomle123",
  port: 5432,
});

app.use(express.static("public"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

db.connect();

async function checkBooks() {
  const result = await db.query("SELECT * FROM books");
  let books = result.rows;

  return books;
}

async function searchBook(title) {
  try {
    const response = await axios.get(
      "https://openlibrary.org/search.json?q=" + title
    );
    return response.data.docs[0];
  } catch (error) {
    console.error("Error fetching book info:", error.message);
  }
}

app.get("/", async (req, res) => {
  const books = await checkBooks();
  /* const cover = await getCover(); */
  /*   console.log(cover); */

  // This block of code is taking the books that you fetched from the api
  // We are then mapping (iterating) over each book and returning a new object with the same properties
  const formattedBooks = books.map((book) => {
    return {
      ...book,
      // This is called a spread operator, it takes all the properties of the book object and puts them in the new object
      date_read: new Date(book.date_read).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      // Since we know the date_read is a date, we can convert it to a more readable format using the toLocaleDateString method
      imageUrl: `http://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`,
      // We are creating a new property called imageUrl that is a string with the book's isbn using the openlibrary api
    };
  });

  res.render("index.ejs", {
    bookInfo: formattedBooks,
  });
});

app.post("/search/", async (req, res) => {
  function formatText(str) {
    return str.replace(/ /g, `+`);
  }
  const searchQuery = formatText(req.body.bookSearch);
  const bookSearch = await searchBook(searchQuery);

  let authorName = bookSearch.author_name[0];
  let bookTitle = bookSearch.title;
  let bookIsbn = bookSearch.isbn[bookSearch.isbn.length - 1];

  console.log(bookTitle);

  res.render("search.ejs", {
    title: bookTitle,
    author: authorName,
    imageUrl: `http://covers.openlibrary.org/b/isbn/${bookIsbn}-L.jpg`,
    isbn: bookIsbn,
  });
});

app.post("/submit/:isbn", async (req, res) => {
  console.log(req.body.isbn);
  try {
    await db.query(
      "INSERT INTO books (title, author, isbn) VALUES ($1, $2, $3)",
      [req.body.title, req.body.author, req.body.isbn]
    );
    res.redirect("/");
  } catch (error) {
    console.log(error);
  }
});

app.post("/edit/:id", async (req, res) => {
  const result = await db.query("SELECT * from books WHERE id = $1", [
    req.body.book_id,
  ]);

  const formattedResult = result.rows.map((format) => {
    return {
      ...format,
      date_read: new Date(format.date_read).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    };
  });

  res.render("edit.ejs", {
    book: formattedResult[0],
    imageUrl: `http://covers.openlibrary.org/b/isbn/${formattedResult[0].isbn}-L.jpg`,
  });
});

app.post("/save/:id", async (req, res) => {
  let editText = req.body.editField;
  let editId = req.body.book_id;

  try {
    await db.query("UPDATE books SET comments = $1 WHERE id = $2", [
      editText,
      editId,
    ]);
    res.redirect("/");
  } catch (error) {
    console.error("error executing edit query", err);
    res.status(500).send("server error");
  }
});

app.post("/delete", async (req, res) => {
  // this deletes something
  let deleteRequest = req.body.book_id;
  try {
    await db.query("DELETE FROM books WHERE id = $1", [deleteRequest]);
    res.redirect("/");
  } catch (error) {
    console.error("error executing delete query", err);
    res.status(500).send("Server error");
  }
});

process.on("SIGINT", () => {
  console.log("Closing DB connection");
  db.end();
  process.exit();
});

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
