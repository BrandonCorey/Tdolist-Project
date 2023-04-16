'use strict';

const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const { body, validationResult } = require('express-validator');
const flash = require('express-flash');
const store = require('connect-loki');
const PgPersistence = require('./lib/pg-persistence');
const catchError = require('./lib/catch-error');


const app = express();
const host = 'localhost';
const port = 3000;

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
  secret: 'this is not very secure',
  store: new LokiStore({}),
}));

app.use(flash());

// Create new data store
// Constructor needs access to req.session so that it can access persited data of store
app.use((req, res, next) => {
  res.locals.store = new PgPersistence();
  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

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
      isDone: store.isDoneTodoList(todoList)
    }));

    res.render('lists', {
      todoLists,
      todosInfo
    });
  })
);

app.get('/lists/new', (req, res) => {
  res.render('new-list');
});

app.get('/lists/:todoListId',
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
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let todoList = await store.loadTodoList(+todoListId);

    if (!todoList) throw new Error('Not found.');
    else res.render('edit-list', { todoList });
  })
);

app.post('/lists',
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
  async (req, res, next) => {
    let store = res.locals.store;
    let { todoListTitle } = req.body;

    const rerenderNewList = () => {
      res.render('new-list', {
        todoListTitle,
        flash: req.flash(),
      });
    }
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(error => req.flash('error', error.msg));
      rerenderNewList();
    } else if (await store.existsTodoListTitle(todoListTitle)) {
        req.flash('error', 'The list title must be unique');
        rerenderNewList();
    } else {
      let creationSuccessful = await store.createTodoList(todoListTitle);
      if (!creationSuccessful) {
        req.flash("error", "The list title must be unique.");
        rerenderNewList();
      } else {
        req.flash('success', 'The todo list has been created!');
        res.redirect(`/lists`);
      }
    }
  }
);

app.post('/lists/:todoListId/todos/:todoId/toggle', 
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId, todoId } = req.params;
    let toggleSuccessful = await store.toggleTodo(+todoListId, +todoId);

    if (!toggleSuccessful) throw new Error('Not Found.');
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
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId, todoId } = req.params;
    let deletionSuccessful = await store.deleteTodo(+todoListId, +todoId);

    if (!deletionSuccessful) throw new Error('Not Found.');
    else {
      req.flash('success', 'The todo has been deleted.');
      res.redirect(`/lists/${todoListId}`);
    }
  })
);

app.post('/lists/:todoListId/complete_all',
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let completeSuccessful = await store.completeAllTodos(+todoListId)

    if (!completeSuccessful) throw new Error('Not found.');
    else {
      req.flash('success', `All todos were marked as done!`);
      res.redirect(`/lists/${todoListId}`);
    }
  })
);

app.post('/lists/:todoListId/todos',
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
        let creationSuccessful = await store.addTodo(+todoListId, todoTitle);
        if (!creationSuccessful) throw new Error('Not found.')
        else {
          req.flash('success', `"${todoTitle}" was added to ${todoList.title}`);
          res.redirect(`/lists/${todoListId}`);
        }
      }
    }
  })
);

app.post('/lists/:todoListId/destroy',
  catchError(async (req, res) => {
    let store = res.locals.store;
    let { todoListId } = req.params;
    let todoList = await store.loadTodoList(+todoListId);
    let deletionSuccessful = await store.deleteTodoList(+todoListId);

    if (!deletionSuccessful) throw new Error('Not found.');
    else {
      req.flash('success', `"${todoList.title}" was successfully deleted!`);
      res.redirect('/lists');
    }
  })
);

app.post('/lists/:todoListId/edit',
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
    }
    
    try {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(error => req.flash('error', error.msg));
        rerenderEditList();
      } else if (await store.existsTodoListTitle(todoListTitle)) {
          req.flash('error', 'The list title must be unique');
          rerenderEditList();
      } else {
        let setTitleSuccessful = await store.setTodoListTitle(+todoListId, todoListTitle);
  
        if (!setTitleSuccessful) throw new Error('Not found.');
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