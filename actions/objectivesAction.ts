import { TurnContext } from 'botbuilder';
import { Application, ConversationHistory, ResponseParser } from '@microsoft/teams-ai';
import { ApplicationTurnState } from '../index';
import { IEmployee, IObjective, IDataEntities } from '../interfaces';
import { stat } from 'fs';

/**
 * @param app
 */
export function objectivesAction(app: Application<ApplicationTurnState>): void {
    app.ai.action('objectives', async (context: TurnContext, state: ApplicationTurnState, data: IDataEntities) => {
        const action = (data.operation ?? '').toLowerCase();
        switch (action) {
            case 'list':
                return await listObjectives(app, context, state);
            case 'update':
                return await updateObjectives(app, context, state, data);
            default:                
                await context.sendActivity(`Oops, my programmer hasn't implemented the ${action} path of 'objectives' yet!`);
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

/**
 * @param app
 * @param context
 * @param state
 */
async function updateObjectives(
    app: Application<ApplicationTurnState>,
    context: TurnContext,
    state: ApplicationTurnState,
    data: IDataEntities
): Promise<boolean> {    
    let newResponse = await app.ai.completePrompt(context, state, 'updateObjectives');
  
    if (!newResponse){
        await context.sendActivity("Sorry, I failed to handle your last message, please rephrase and try again.");
        return false;    
    }
    else
    {
        let updatedEmployee = ResponseParser.parseJSON(newResponse) as IEmployee;
        console.info(`\n updatedEmployee name: ${updatedEmployee.name}`);
        let employeeToUpdateIndex = state.user.value.employees.findIndex(emp => emp.name == updatedEmployee.name);
        if (employeeToUpdateIndex != -1)
        {
            state.user.value.employees[employeeToUpdateIndex] = updatedEmployee;
            await context.sendActivity(`Ok, I've updated the objective for ${data.employee}. What can I do for you next?`);
            return false;
        }
        else
        {            
            await context.sendActivity("Sorry, I failed to handle your last message correctly, please rephrase and try again.");
            return false;
        }
    }
}