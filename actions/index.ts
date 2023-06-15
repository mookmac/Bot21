import { Application } from '@microsoft/teams-ai';
import { ApplicationTurnState } from '../index';
import { objectivesAction } from './objectivesAction';
import { talkingPointsAction } from './talkingPointsAction';

/**
 * @param app
 * @param planner
 */
export function addActions(app: Application<ApplicationTurnState>): void {
    objectivesAction(app);
    talkingPointsAction(app);
}