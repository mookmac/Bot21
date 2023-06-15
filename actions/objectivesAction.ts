import { TurnContext } from 'botbuilder';
import { Application, ConversationHistory } from '@microsoft/teams-ai';
import { ApplicationTurnState } from '../index';
import { IEmployee, IObjective, IDataEntities } from '../interfaces';

/**
 * @param app
 */
export function objectivesAction(app: Application<ApplicationTurnState>): void {
    app.ai.action('objectives', async (context: TurnContext, state: ApplicationTurnState, data: IDataEntities) => {
        const action = (data.operation ?? '').toLowerCase();
        switch (action) {
            case 'list':
                return await listObjectives(app, context, state);
            default:
                await context.sendActivity(`[map.${action}]`);
                return true;
        }
      });
}

/**
 * @param app
 * @param context
 * @param state
 */
async function listObjectives(
    app: Application<ApplicationTurnState>,
    context: TurnContext,
    state: ApplicationTurnState
): Promise<boolean> {
    // Use the employee object to answer the human
    const newResponse = await app.ai.completePrompt(context, state, 'listEmployees');
    if (newResponse) {
        await context.sendActivity(newResponse);
        ConversationHistory.appendToLastLine(state, ` THEN SAY ${newResponse}`);
    } else {
        await context.sendActivity("Error finding that information. Please try again.");
    }

    return false;
}