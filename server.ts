import express, { Request, Response } from 'express';
import path from 'path';
import { quizEngine } from './src/server/quizEngine';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// RPC Handler for Canara COE Knowledge Challenge
app.post('/api/rpc/:fn', async (req: Request, res: Response) => {
  const { fn } = req.params;
  const body = req.body || {};

  try {
    let result: any;
    switch (fn) {
      // Participant functions
      case 'quiz_state':
        result = quizEngine.getQuizState(body.p_code);
        break;
      case 'get_questions':
        result = quizEngine.getQuestionsForPlayer(body.p_code);
        break;
      case 'join':
        result = quizEngine.join(body.p_code, body.p_name, body.p_pin, body.p_order);
        break;
      case 'submit':
        result = quizEngine.submitAnswer(body.p_player, body.p_pin, body.p_idx, body.p_choice, body.p_ms);
        break;
      case 'fifty':
        result = quizEngine.useFifty(body.p_player, body.p_pin, body.p_idx);
        break;
      case 'restart':
        result = quizEngine.restartPlayer(body.p_player, body.p_pin, body.p_order);
        break;
      case 'reveal':
        result = quizEngine.revealForPlayer(body.p_player, body.p_pin, body.p_idx);
        break;
      case 'my_rank':
        result = quizEngine.getPlayerRank(body.p_player);
        break;
      case 'top':
        result = quizEngine.getTopN(body.p_code, body.p_n);
        break;
      case 'board':
        result = quizEngine.getLeaderboard(body.p_code, body.p_since);
        break;

      // Administrator and Host functions
      case 'admin_login':
        result = quizEngine.adminLogin(body.p_user, body.p_pass);
        break;
      case 'admin_logout':
        quizEngine.adminLogout(body.p_token);
        result = { success: true };
        break;
      case 'admin_change_password':
        quizEngine.adminChangePassword(body.p_token, body.p_old, body.p_new);
        result = { success: true };
        break;
      case 'admin_list':
        result = quizEngine.getQuizList(body.p_token);
        break;
      case 'create_quiz':
        result = quizEngine.createQuiz(body.p_token, body.p_title, body.p_settings, body.p_questions);
        break;
      case 'admin_get':
        result = quizEngine.getQuizAdmin(body.p_token, body.p_code);
        break;
      case 'admin_update_quiz':
        result = quizEngine.updateQuiz(body.p_token, body.p_code, body.p_title, body.p_settings);
        break;
      case 'admin_duplicate':
        result = quizEngine.duplicateQuiz(body.p_token, body.p_code, body.p_title);
        break;
      case 'admin_delete_quiz':
        quizEngine.deleteQuiz(body.p_token, body.p_code);
        result = { success: true };
        break;
      case 'admin_reset':
        quizEngine.resetSession(body.p_token, body.p_code);
        result = { success: true };
        break;
      case 'admin_save_question':
        quizEngine.saveQuestion(body.p_token, body.p_code, body.p_idx, body.p_q);
        result = { success: true };
        break;
      case 'admin_delete_question':
        quizEngine.deleteQuestion(body.p_token, body.p_code, body.p_idx);
        result = { success: true };
        break;
      case 'admin_replace_questions':
        quizEngine.replaceQuestions(body.p_token, body.p_code, body.p_questions);
        result = { success: true };
        break;
      case 'admin_set_all_times':
        quizEngine.setAllTimes(body.p_token, body.p_code, body.p_secs);
        result = { success: true };
        break;
      case 'host_set_status':
        quizEngine.hostSetStatus(body.p_token, body.p_code, body.p_status);
        result = { success: true };
        break;
      case 'host_set_timer':
        quizEngine.hostSetTimer(body.p_token, body.p_code, body.p_secs);
        result = { success: true };
        break;
      case 'host_live_action':
        result = quizEngine.hostLiveAction(body.p_token, body.p_code, body.p_action, body.p_q, body.p_pos, body.p_secs);
        break;
      case 'host_live':
        result = quizEngine.hostLive(body.p_token, body.p_code);
        break;
      case 'host_stats':
        result = quizEngine.hostStats(body.p_token, body.p_code);
        break;
      case 'admin_simulate_trainees':
        result = quizEngine.simulateTrainees(body.p_token, body.p_code, body.p_count || 5);
        break;

      default:
        res.status(404).json({ message: `Function ${fn} not found` });
        return;
    }

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Operation failed' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    institution: 'Canara Centre of Excellence',
    title: 'Canara COE Knowledge Challenge',
    trainer: 'Punit Dhull | Senior Manager'
  });
});

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🏦 Canara COE Knowledge Challenge Server`);
    console.log(`Trainer: Punit Dhull | Senior Manager`);
    console.log(`Institution: Canara Centre of Excellence`);
    console.log(`Running on: http://0.0.0.0:${PORT}`);
    console.log(`Default Admin: admin / Canara@COE2026`);
    console.log(`==================================================\n`);
  });
}

startServer();
