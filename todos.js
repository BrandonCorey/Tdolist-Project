'use strict';

const config = require('./lib/config');
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const flash = require('express-flash');
const store = require('connect-loki');
const PgPersistence = require('./lib/pg-persistence');
const catchError = require('./lib/catch-error');


const app = express();
const host = config.HOST;
const port = config.PORT;
const LokiStore = store(session);

app.set('views', './views');
app.set('view engine', 'pug');

app.use(morgan('common'));
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000,
    path: '/',
    secure: false,
  },
  name: 'todos-session-id',
  resave: false,
  saveUninitialized: true,
  secret: config.SECRET,
  store: new LokiStore({}),
}));

app.use(flash());

// Create new data store
// Constructor needs access to req.session so that it can access persited data of store
app.use((req, res, next) => {
  res.locals.store = new PgPersistence(req.session);
  next();
});

app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.signedIn = req.session.signedIn;
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Custom middleware that checks if a user is signed in before preceding with certain route handlers
const requiresAuthentification = (req, res, next) => {
  if (!res.locals.signedIn) {
    res.redirect(302, '/users/signin');
  } else {
    next();
  }
};

app.get('/', (req, res) => {
  res.redirect('/lists');
});

app.get('/lists',
  catchError(async (req, res) => {
    let store = res.locals.store;
    let todoLists = await store.sortedTodoLists();

    let todosInfo = todoLists.map(todoList => ({
      countAllTodos: todoList.todos.length,
      countDoneTodos: todoList.todos.filter(todo => todo.done).length,
      isDone: store.isDoneTodoList(todoList),
    }));

    res.render('lists', {
      todoLists,
      todosInfo
    });
  })
);

app.get('/lists/new',
  requiresAuthentification,
  (req, res) => {
    res.render('new-list');
  });

app.get('/lists/:todoListId',
  requiresAuthentification,
  catchError(async (req, res) => {

    let store = res.locals.store;
    let { todoListId } = req.params;
    let todoList = await store.loadTodoList(+todoListId);

    if (!todoList) throw new Error('Not found.');
    else {
      todoList.todos = await store.sortedTodos(todoList);

      res.render('list', {
        todoList,
        isDoneTodoList: store.isDoneTodoList(todoList),
        hasUndoneTodos: store.hasUndoneTodos(todoList),
      });
    }
  })
);

app.get('/lists/:todoListId/edit',
  requiresAuthentification,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let todoList = await store.loadTodoList(+todoListId);

    if (!todoList) throw new Error('Not found.');
    else res.render('edit-list', { todoList });
  })
);

app.get('/users/signin', (req, res) => {
  req.flash('info', 'Please sign in.');
  res.render('sign-in', {
    flash: Object.assign({}, res.locals.flash, req.flash()),
  });
});


app.get('/users/signup', (req, res) => {
  req.flash('info', 'Please provide username and password.');
  res.render('sign-up', {
    flash: req.flash()
  });
});

app.post('/users/signin',
  async (req, res) => {
    let store = res.locals.store;
    let { username, password } = req.body;
    let authenticated = await store.authenticateUser(username, password);

    if (!authenticated) {
      req.flash('error', 'Invalid Credentials.');
      res.render('sign-in', {
        flash: req.flash(),
        username: req.body.username
      });
    } else {
      req.session.username = username;
      req.session.signedIn = true;
      res.redirect('/lists');
    }
  }
);

app.post('/users/signout', (req, res) => {
  delete req.session.username;
  delete req.session.signedIn;
  res.redirect('/lists');
});

app.post('/users/signup',
  [
    body('username')
      .trim()
      .isLength({ min: 1} )
      .withMessage('A username is required.')
      .bail()
      .isLength({ max: 100 })
      .withMessage('A username must be less than 100 characters'),
    body('password')
      .trim()
      .isLength({ min: 8 })
      .withMessage('A password must be greater than 8 characters long.')
      .bail()
      .isLength({ max: 100 })
      .withMessage('A password must be less than 100 characters long')
      .bail()
      .custom((username) => {
        let lowerChar = /[a-z]/;
        let upperChar = /[A-Z]/;
        let digit = /\d/;

        return lowerChar.test(username) && upperChar.test(username) && digit.test(username);
      })
      .withMessage('Password must contain at least one lowercase, one uppercase, and one digit character.')
      .bail(),
    body('confirmPassword')
      .custom((confirmPassword, { req }) => {
        return confirmPassword === req.body.password;
      })
      .withMessage('Passwords do not match.')
  ],
  catchError(async (req, res) => {
    let store = res.locals.store;
    let errors = validationResult(req);
    let { username, password } = req.body;
    errors.array().forEach(error => req.flash('error', error.msg));

    const rerenderNewUser = () => {
      res.render('sign-up', {
        flash: req.flash(),
        username
      });
    };

    if (!errors.isEmpty()) {
      rerenderNewUser();
    } else if (await store.existsUsername(username)) {
      req.flash('error', 'A user with that name already exists.');
      rerenderNewUser();
    } else {
      let created = await store.createUserAccount(username, password);

      if (!created) {
        req.flash('A user with that name already exists.');
        rerenderNewUser();
      } else {
        req.flash('success', 'Account successfully created!');
        res.redirect('/users/signin');
      }
    }
  })
);

app.post('/lists',
  requiresAuthentification,
  [
    body('todoListTitle')
      .trim()
      .isLength({ min: 1 })
      .withMessage('A list title is required.')
      .bail()
      .isLength({ max: 100})
      .withMessage('The title must be less than 100 characters'),
  ],
  catchError(async (req, res, next) => {
    let store = res.locals.store;
    let { todoListTitle } = req.body;

    const rerenderNewList = () => {
      res.render('new-list', {
        todoListTitle,
        flash: req.flash(),
      });
    };
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash('error', error.msg));
      rerenderNewList();
    } else if (await store.existsTodoListTitle(todoListTitle)) {
      req.flash('error', 'The list title must be unique');
      rerenderNewList();
    } else {
      let created = await store.createTodoList(todoListTitle);
      if (!created) {
        req.flash("error", "The list title must be unique.");
        rerenderNewList();
      } else {
        req.flash('success', 'The todo list has been created!');
        res.redirect(`/lists`);
      }
    }
  })
);

app.post('/lists/:todoListId/todos/:todoId/toggle',
  requiresAuthentification,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId, todoId } = req.params;
    let toggled = await store.toggleTodo(+todoListId, +todoId);

    if (!toggled) throw new Error('Not Found.');
    else {
      let todo = await store.loadTodo(+todoListId, +todoId);

      if (todo.done) {
        req.flash("success", `"${todo.title}" marked done.`);
      } else {
        req.flash("success", `"${todo.title}" marked as NOT done!`);
      }
      res.redirect(`/lists/${todoListId}`);
    }
  })
);

app.post('/lists/:todoListId/todos/:todoId/destroy',
  requiresAuthentification,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId, todoId } = req.params;
    let deleted = await store.deleteTodo(+todoListId, +todoId);

    if (!deleted) throw new Error('Not Found.');
    else {
      req.flash('success', 'The todo has been deleted.');
      res.redirect(`/lists/${todoListId}`);
    }
  })
);

app.post('/lists/:todoListId/complete_all',
  requiresAuthentification,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let completed = await store.completeAllTodos(+todoListId);

    if (!completed) throw new Error('Not found.');
    else {
      req.flash('success', `All todos were marked as done!`);
      res.redirect(`/lists/${todoListId}`);
    }
  })
);

app.post('/lists/:todoListId/todos',
  requiresAuthentification,
  [
    body('todoTitle')
      .isLength({ min: 1 })
      .withMessage('A title is required.')
      .bail()
      .isLength({ max: 100 })
      .withMessage('The title must be less than 100 characters long.')
  ],
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let { todoTitle } = req.body;
    let todoList = await store.loadTodoList(+todoListId);

    if (!todoList) throw new Error('Not found.');
    else {
      let errors = validationResult(req);

      if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash('error', error.msg));
        res.render('list', {
          todoList,
          isDoneTodoList: store.isDoneTodoList(todoList),
          hasUndoneTodos: store.hasUndoneTodos(todoList),
          todoTitle,
          flash: req.flash(),
        });
      } else {
        let created = await store.addTodo(+todoListId, todoTitle);
        if (!created) throw new Error('Not found.');
        else {
          req.flash('success', `"${todoTitle}" was added to ${todoList.title}`);
          res.redirect(`/lists/${todoListId}`);
        }
      }
    }
  })
);

app.post('/lists/:todoListId/destroy',
  requiresAuthentification,
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let todoList = await store.loadTodoList(+todoListId);
    let deleted = await store.deleteTodoList(+todoListId);

    if (!deleted) throw new Error('Not found.');
    else {
      req.flash('success', `"${todoList.title}" was successfully deleted!`);
      res.redirect('/lists');
    }
  })
);

app.post('/lists/:todoListId/edit',
  requiresAuthentification,
  [
    body('todoListTitle')
      .trim()
      .isLength({ min: 1 })
      .withMessage('A list title is required.')
      .bail()
      .isLength({ max: 100})
      .withMessage('The title must be less than 100 characters')
      .bail()
      .withMessage('List title already in use.')
  ],
  catchError(async (req, res, next) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let { todoListTitle } = req.body;

    const rerenderEditList = async () => {
      let todoList = await store.loadTodoList(+todoListId);

      if (!todoList) next(new Error('Not found.'));
      else {
        res.render('edit-list', {
          todoList,
          todoListTitle,
          flash: req.flash(),
        });
      }
    };

    try {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash('error', error.msg));
        rerenderEditList();
      } else if (await store.existsTodoListTitle(todoListTitle)) {
        req.flash('error', 'The list title must be unique');
        rerenderEditList();
      } else {
        let titleSet = await store.setTodoListTitle(+todoListId, todoListTitle);

        if (!titleSet) throw new Error('Not found.');
        else {
          req.flash('success', 'List name was successfully changed!');
          res.redirect(`/lists/${todoListId}`);
        }
      }
    } catch (error) {
      if (store.isUniqueConstraintViolation(error)) {
        req.flash("error", "The list title must be unique.");
        rerenderEditList();
      } else {
        throw error;
      }
    }
  })
);

app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

app.listen(port, host, () => {
  console.log(`Listening on port ${port} of ${host}`);
});