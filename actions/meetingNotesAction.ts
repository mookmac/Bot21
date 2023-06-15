import { TurnContext } from 'botbuilder';
import { Application, ConversationHistory } from '@microsoft/teams-ai';
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
            case 'save':
                return await recallMeetingNotes(app, context, state, data);
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
            employeeName: (data.employee ?? 'UNKNOWN'),
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
        await context.sendActivity(`I've saved the following meeting note for ${data.employee}: ${newResponse}`);
    } else {
        await context.sendActivity("Error parsing that information. Please try again.");
    }

    return false;
}

/**
 * @param app
 * @param context
 * @param state
 */
async function recallMeetingNotes(
    app: Application<ApplicationTurnState>,
    context: TurnContext,
    state: ApplicationTurnState,
    data: IDataEntities
): Promise<boolean> {    
        if (state.user.value.meetingNotes == undefined || state.user.value.meetingNotes.findIndex(note => note.employeeName = data.employee) == -1)
        {      
            await context.sendActivity("No meeting notes were found.");  
            return false;  
        }
        else
        {
            state.temp.value.filteredMeetingNotes = state.user.value.meetingNotes.filter(note => note.employeeName = data.employee);
            let newResponse = await app.ai.completePrompt(context, state, 'recallMeetingNotes');
            if (newResponse)
            {
                await context.sendActivity(newResponse);
                ConversationHistory.addLine(state, newResponse, 20);
                return false;
            }
            else {
                await context.sendActivity("Error generating that information. Please try again.");
            }
        }

    return false;
}