// Import required packages
import * as path from 'path';
import * as restify from "restify";
import { AdaptiveCards } from "@microsoft/adaptivecards-tools";
import rawNewObjectiveCard from "./adaptiveCards/newObjective.json";
import rawListEmployeesCard from "./adaptiveCards/employeeList.json";

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
import {
  CloudAdapter,
  ConfigurationServiceClientCredentialFactory,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  MemoryStorage,
  CardFactory
} from "botbuilder";

import { BlobsStorage } from "botbuilder-azure-blobs";

// This bot's main dialog.
import { TeamsBot } from "./teamsBot";
import config from "./config";
import { AI, 
  Application, 
  ConversationHistory, 
  DefaultConversationState, 
  DefaultTempState, 
  DefaultPromptManager, 
  DefaultTurnState, 
  DefaultUserState, 
  OpenAIModerator, 
  OpenAIPlanner, 
  ResponseParser } from "@microsoft/teams-ai";
import { randomInt } from 'crypto';
import { IEmployee, IObjective, IDataEntities } from './interfaces';
import { stat } from 'fs';
import { addActions } from './actions';

// initialized to access values in .env file.
const ENV_FILE = path.join(__dirname, 'env/.env.local.user');
require('dotenv').config({ path: ENV_FILE });

// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
  MicrosoftAppId: config.botId,
  MicrosoftAppPassword: config.botPassword,
  MicrosoftAppType: "MultiTenant",
});

const botFrameworkAuthentication = new ConfigurationBotFrameworkAuthentication(
  {},
  credentialsFactory
);

const adapter = new CloudAdapter(botFrameworkAuthentication);

// Catch-all for errors.
const onTurnErrorHandler = async (context: TurnContext, error: Error) => {
  // This check writes out errors to console log .vs. app insights.
  // NOTE: In production environment, you should consider logging this to Azure
  //       application insights.
  console.error(`\n [onTurnError] unhandled error: ${error}`);

  // Send a trace activity, which will be displayed in Bot Framework Emulator
  await context.sendTraceActivity(
    "OnTurnError Trace",
    `${error}`,
    "https://www.botframework.com/schemas/error",
    "TurnError"
  );

  // Send a message to the user
  await context.sendActivity(`The bot encountered unhandled error:\n ${error.message}`);
  await context.sendActivity("To continue to run this bot, please fix the bot source code.");
};

// Set the onTurnError for the singleton CloudAdapter.
adapter.onTurnError = onTurnErrorHandler;

// Create the bot that will handle incoming messages.
const bot = new TeamsBot();

// Create HTTP server.
const server = restify.createServer();
server.use(restify.plugins.bodyParser());
server.listen(process.env.port || process.env.PORT || 3978, () => {
  console.log(`\nBot Started, ${server.name} listening to ${server.url}`);
});

//Teams AI Library

//create state
export interface ConversationState extends DefaultConversationState {
  InitiativeRoll: number;
  talkingPointSuggestions: string[];
}
export interface UserState extends DefaultUserState {
  managerName: string;
  employees: IEmployee[];
  addOneSaid: boolean;
}
export interface TempState extends DefaultTempState {
  prompt: string;
}
export type ApplicationTurnState = DefaultTurnState<ConversationState, UserState, TempState>;

//define AI library components

//define planner
const planner = new OpenAIPlanner({
  apiKey: config.OpenAIKey,
  defaultModel: "text-davinci-003",
  logRequests: true,
});

//define moderator
const moderator = new OpenAIModerator({
  apiKey: config.OpenAIKey,
  moderate: "both"
});

//define prompt manager
const promptManager = new DefaultPromptManager<ApplicationTurnState>(path.join(__dirname, "./prompts"));

//define storage
const storage = new BlobsStorage(
  process.env.BlobConnectionString,
  process.env.BlobContainerName
);
/*const storage = new MemoryStorage();*/

//define AI app
const app = new Application<ApplicationTurnState>({
  storage,
  ai: {
    planner,
    moderator,
    promptManager,
    prompt: async (context: TurnContext, state: ApplicationTurnState) => state.temp.value.prompt,
    history: {
      assistantHistoryType: "text",
      userPrefix: 'Human:',
      assistantPrefix: 'Bot21:'
    }
  }
});

app.turn('beforeTurn', async (context: TurnContext, state: ApplicationTurnState) => {
  if(!state.user.value.managerName){
    state.user.value.managerName = (context.activity.from?.name ?? '');
    if (state.user.value.managerName.length == 0){
      state.user.value.managerName = 'Michael Scott';
    }

    state.temp.value.prompt = 'welcome';
    return true;
  }  
  
  state.temp.value.prompt = 'chat';

  return true;
});

app.turn('afterTurn', async (context: TurnContext, state: ApplicationTurnState) => {
  const lastSay = ConversationHistory.getLastSay(state);
  
  if (!lastSay){
    ConversationHistory.removeLastLine(state);
    await context.sendActivity("Sorry, I failed to generate a response to your last message, please rephrase and try again.");
    return false;    
  }

  return true;
});

//define actions
addActions(app);

app.ai.action(AI.FlaggedInputActionName, async (context, state,data) => {
  await context.sendActivity("Your message was flagged by the moderator.");
  return false;
});

app.ai.action(AI.FlaggedOutputActionName,async (context, state,data) => {
  await context.sendActivity("Bot's response was flagged by moderator");
  return false;
});

// Listen for messages that trigger returning an adaptive card
app.message(/add objective/i, async (context, state) => {
  const card = AdaptiveCards.declareWithoutData(rawNewObjectiveCard).render();
  await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
});

app.message(/list employees/i, async (context, state) => {
  if (state.user.value.employees == undefined)
  {
    let errorMsg = "You haven't told me about any employees yet. Please start by using the \"add objective\" command to create an objective for your first employee.";
    await context.sendActivity(errorMsg);
    ConversationHistory.addLine(state, errorMsg);
  }
  else
  {
    const card = AdaptiveCards.declare<UserState>(rawListEmployeesCard).render(state.user.value);
    await context.sendActivity({ attachments: [CardFactory.adaptiveCard(card)] });
  }
});

//listen for reset message
const resetRegex = `/^(?:.*\s)?\/(reset|restart)|^(reset|restart)\(?\)?$/i`;
app.message(resetRegex, async (context, state) => {
  state.conversation.delete();
  await context.sendActivity(`Ok I have deleted the conversation history.`);
});

interface newObjectiveCardData {
  employeeName?: string;
  title?: string;
  description?: string;
  targetCompletionDate?: Date;
  measure?: string;
  progress?: number;
}

//listen for adaptive card submissions
app.adaptiveCards.actionSubmit('newObjectiveSubmit', async (context, state, data: newObjectiveCardData) => {
  let confirmationMsg = `Ok! Added that objective for ${data.employeeName}. What do you want me to do next?`;
  ConversationHistory.addLine(state, confirmationMsg);
  await context.sendActivity(confirmationMsg);
  
  if (state.user.value.employees == undefined)
  {
    const newIObjective: IObjective = {
      title: data.title,
      description: data.description,
      targetCompletionDate: data.targetCompletionDate,
      measure: data.measure,
      progress: data.progress
    }
    const newIEmployee: IEmployee = {
      name: data.employeeName,
      position: "unknown",
      objectives: [newIObjective]
    }
    state.user.value.employees = [newIEmployee];
  }
  else 
  {
    if (state.user.value.employees.filter(emp => emp.name == data.employeeName).length == 1)
    {
      const newIObjective: IObjective = {
        title: data.title,
        description: data.description,
        targetCompletionDate: data.targetCompletionDate,
        measure: data.measure,
        progress: data.progress
      }
      state.user.value.employees.find(emp => emp.name == data.employeeName).objectives.push(newIObjective);
    }
    else if (state.user.value.employees.filter(emp => emp.name == data.employeeName).length == 0)
    {
      const newIObjective: IObjective = {
        title: data.title,
        description: data.description,
        targetCompletionDate: data.targetCompletionDate,
        measure: data.measure,
        progress: data.progress
      }
      const newIEmployee: IEmployee = {
        name: data.employeeName,
        position: "unknown",
        objectives: [newIObjective]
      }
      state.user.value.employees.push(newIEmployee);
    }
  }

  state.temp.value.prompt = 'chat';   
});
  
//define history
app.message("/history", async(context,state) => {
  const history = ConversationHistory.toString(state,2000,'\n\n');
  await context.sendActivity(history);
});

// Listen for incoming requests.
server.post("/api/messages", async (req, res) => {
  await adapter.process(req, res, async (context) => {
    await app.run(context);
  });
});
