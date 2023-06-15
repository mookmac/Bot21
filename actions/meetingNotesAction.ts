import { TurnContext } from 'botbuilder';
import { Application } from '@microsoft/teams-ai';
import { ApplicationTurnState } from '../index';
import { IMeetingNotes, IDataEntities } from '../interfaces';
import { stat } from 'fs';

/**
 * @param app
 */
export function meetingNotesAction(app: Application<ApplicationTurnState>): void {
    app.ai.action('meetingNotes', async (context: TurnContext, state: ApplicationTurnState, data: IDataEntities) => {
        const action = (data.operation ?? '').toLowerCase();
        switch (action) {
            case 'save':
                return await saveMeetingNotes(app, context, state, data);
            default:
                return await saveMeetingNotes(app, context, state, data);
        }
      });
}

/**
 * @param app
 * @param context
 * @param state
 */
async function saveMeetingNotes(
    app: Application<ApplicationTurnState>,
    context: TurnContext,
    state: ApplicationTurnState,
    data: IDataEntities
): Promise<boolean> {
    // Use the employee object to answer the human
    const newResponse = await app.ai.completePrompt(context, state, 'summariseMeetingNote');
    if (newResponse) {
        let newNote: IMeetingNotes = {
            employeeName: (data.employee.name ?? 'UNKNOWN'),
            date: new Date(),
            notes: newResponse
        }

        if (state.user.value.meetingNotes == undefined)
        {            
            state.user.value.meetingNotes = [newNote];
        }
        else
        {
            state.user.value.meetingNotes.push(newNote);
        }
        await context.sendActivity(`I've saved the following meeting note for ${data.employee.name}: ${newResponse}`);
    } else {
        await context.sendActivity("Error parsing that information. Please try again.");
    }

    return false;
}