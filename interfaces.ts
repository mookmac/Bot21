export interface IEmployee {
    name: string;
    position: string;
    objectives: IObjective[];
}

export interface IObjective {
    title: string;
    description: string;
    targetCompletionDate: Date;
    measure: string;
    progress: number;
}

export interface IDataEntities {
    operation: string;
    employee: IEmployee;
}