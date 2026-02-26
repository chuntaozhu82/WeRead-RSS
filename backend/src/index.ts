import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';

dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

const MOCK_MODE = process.env.MOCK_MODE === 'true' || 
  (!process.env.MONGODB_URI && !process.env.REDIS_URL);

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') 
    : '*',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mockMode: MOCK_MODE
  });
});

app.get('/api/v1', (req, res) => {
  res.json({
    name: 'WeRead RSS API',
    version: '1.0.0',
    description: 'Content Management System for WeChat Articles',
    mockMode: MOCK_MODE
  });
});

if (MOCK_MODE) {
  console.log('[MOCK MODE] Running without database connections');

  const mockUsers: Map<string, any> = new Map();
  const mockArticles: Map<string, any> = new Map();
  const mockTasks: Map<string, any> = new Map();

  app.post('/api/v1/auth/login', (req, res) => {
    const { code } = req.body;
    const openid = `mock_openid_${Date.now()}`;
    const userId = `mock_user_${Date.now()}`;
    
    mockUsers.set(userId, {
      _id: userId,
      openid,
      settings: {
        defaultCloudService: 'aliyun',
        aiModel: 'gpt-3.5-turbo',
        autoTags: true,
        storagePath: '/WeRead',
        tagRules: []
      }
    });

    res.json({
      status: 'success',
      data: {
        token: `mock_token_${userId}`,
        user: {
          id: userId,
          openid,
          settings: mockUsers.get(userId).settings
        }
      }
    });
  });

  app.get('/api/v1/auth/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] === '') {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const userId = token.replace('mock_token_', '');
    
    if (!token.startsWith('mock_token_')) {
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
    
    const user = mockUsers.get(userId);
    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }

    res.json({
      status: 'success',
      data: { user }
    });
  });

  app.post('/api/v1/articles', (req, res) => {
    const { url } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const taskId = `task_${Date.now()}`;
    const articleId = `article_${Date.now()}`;

    mockTasks.set(taskId, {
      taskId,
      status: 'queued',
      progress: {
        current: '等待处理',
        percentage: 0,
        steps: [
          { name: '抓取文章', status: 'pending' },
          { name: '解析内容', status: 'pending' },
          { name: 'AI处理', status: 'pending' },
          { name: '上传云盘', status: 'pending' }
        ]
      }
    });

    mockArticles.set(articleId, {
      _id: articleId,
      url,
      taskId,
      title: '处理中...',
      status: 'pending'
    });

    res.status(201).json({
      status: 'success',
      data: {
        taskId,
        articleId,
        status: 'queued'
      }
    });
  });

  app.get('/api/v1/articles', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const articles = Array.from(mockArticles.values());
    res.json({
      status: 'success',
      data: {
        articles,
        pagination: {
          page: 1,
          limit: 20,
          total: articles.length,
          pages: 1
        }
      }
    });
  });

  app.get('/api/v1/tasks', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] === '') {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    const userId = token.replace('mock_token_', '');
    if (!token.startsWith('mock_token_') || !mockUsers.has(userId)) {
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
    
    const tasks = Array.from(mockTasks.values());
    res.json({
      status: 'success',
      data: {
        tasks,
        pagination: {
          page: 1,
          limit: 20,
          total: tasks.length,
          pages: 1
        }
      }
    });
  });

  app.get('/api/v1/tasks/:taskId', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] === '') {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    const userId = token.replace('mock_token_', '');
    if (!token.startsWith('mock_token_') || !mockUsers.has(userId)) {
      return res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
    
    const task = mockTasks.get(req.params.taskId);
    if (!task) {
      return res.status(404).json({ status: 'error', message: 'Task not found' });
    }
    res.json({ status: 'success', data: { task } });
  });

  app.get('/api/v1/cloud/status', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    res.json({
      status: 'success',
      data: {
        connected: {
          aliyun: false,
          baidu: false,
          webdav: false
        },
        defaultService: 'aliyun'
      }
    });
  });

  app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Not found' });
  });

} else {
  const { connectDatabase } = require('./config/database');
  const { connectRedis } = require('./config/redis');
  const { logger } = require('./utils/logger');
  const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
  const { rateLimiter } = require('./middleware/rateLimiter');
  const { requestLogger } = require('./middleware/requestLogger');

  const authRoutes = require('./routes/auth.routes').default;
  const articleRoutes = require('./routes/article.routes').default;
  const taskRoutes = require('./routes/task.routes').default;
  const userRoutes = require('./routes/user.routes').default;
  const settingsRoutes = require('./routes/settings.routes').default;
  const cloudRoutes = require('./routes/cloud.routes').default;

  app.use(requestLogger);
  app.use(rateLimiter);

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/articles', articleRoutes);
  app.use('/api/v1/tasks', taskRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/cloud', cloudRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  async function startServer() {
    try {
      await connectDatabase();
      logger.info('Database connected successfully');

      await connectRedis();
      logger.info('Redis connected successfully');

      server.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      });

      process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      });

      process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down gracefully');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  startServer();
}

if (MOCK_MODE) {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (Mock Mode)`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

export { app, server };