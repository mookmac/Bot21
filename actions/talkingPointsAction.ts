import { TurnContext } from 'botbuilder';
import { Application, ConversationHistory } from '@microsoft/teams-ai';
import { ApplicationTurnState } from '../index';
import { IEmployee, IObjective, IDataEntities } from '../interfaces';
import { stat } from 'fs';

/**
 * @param app
 */
export function talkingPointsAction(app: Application<ApplicationTurnState>): void {
    app.ai.action('talkingPoints', async (context: TurnContext, state: ApplicationTurnState, data: IDataEntities) => {
        const action = (data.operation ?? '').toLowerCase();
        switch (action) {
            case 'suggest':
                return await suggestTalkingPoints(app, context, state);
            default:
                await context.sendActivity(`Oops, my programmer hasn't implemented the ${action} path of 'talkingPoints' yet!`);
                return true;
        }
      });
}

/**
 * @param app
 * @param context
 * @param state
 */
async function suggestTalkingPoints(
    app: Application<ApplicationTurnState>,
    context: TurnContext,
    state: ApplicationTurnState
): Promise<boolean> {
    // Use the employee object to answer the human
    const newResponse = await app.ai.completePrompt(context, state, 'suggestTalkingPoints');
    if (newResponse) {
        if (state.conversation.value.talkingPointSuggestions == undefined)
        {
            state.conversation.value.talkingPointSuggestions = [newResponse];
        }
        else
        {
            state.conversation.value.talkingPointSuggestions.push(newResponse);
        }
        await context.sendActivity(newResponse);
    } else {
        await context.sendActivity("Error finding that information. Please try again.");
    }

    return false;
}