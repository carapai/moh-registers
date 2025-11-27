import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import React from "react";

import { Flex } from "antd";
import { resourceQueryOptions } from "../query-options";
import { Program, ProgramRule, ProgramRuleVariable } from "../schemas";
import { TrackerContext } from "../machines/tracker";

export const RootRoute = createRootRouteWithContext<{
    queryClient: QueryClient;
    engine: ReturnType<typeof useDataEngine>;
}>()({
    component: RootRouteComponent,
    loader: async ({ context: { queryClient, engine } }) => {
        const { options } = await queryClient.ensureQueryData(
            resourceQueryOptions<{
                options: { id: string; name: string; code: string }[];
            }>({
                engine,
                resource: "optionSets/QwsvSPpnRul/options",
                params: {},
            }),
        );
        const program = await queryClient.ensureQueryData(
            resourceQueryOptions<Program>({
                engine,
                resource: "programs",
                id: "ueBhWkWll5v",
                params: {
                    fields: "id,name,trackedEntityType[id,featureType],programType,featureType,selectEnrollmentDatesInFuture,selectIncidentDatesInFuture,organisationUnits,programStages[id,repeatable,featureType,name,code,programStageDataElements[id,compulsory,name],programStageSections[id,name,sortOrder,description,displayName,dataElements[id,name,code,valueType,formName,optionSetValue,optionSet[id,name,options[id,name,code]]]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,displayInList,trackedEntityAttribute[id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,optionSet[id,name,options[id,name,code]]]],programRuleVariables[*],programRules[*,programRuleActions[*]]",
                },
            }),
        );

        const me = await queryClient.ensureQueryData(
            resourceQueryOptions<{
                organisationUnits: {
                    id: string;
                    name: string;
                    level: number;
                    parent?: { id: string };
                    leaf: boolean;
                }[];
            }>({
                engine,
                resource: "me",
                params: {
                    fields: "organisationUnits[id,name,level,parent,leaf]",
                },
            }),
        );

        const programRules = await queryClient.ensureQueryData(
            resourceQueryOptions<{ programRules: ProgramRule[] }>({
                engine,
                resource: `programRules.json`,
                params: {
                    filter: "program.id:eq:ueBhWkWll5v",
                    fields: "*,programRuleActions[*]",
                    paging: false,
                },
            }),
        );

        const programRuleVariables = await queryClient.ensureQueryData(
            resourceQueryOptions<{
                programRuleVariables: ProgramRuleVariable[];
            }>({
                engine,
                resource: `programRuleVariables.json`,
                params: {
                    filter: "program.id:eq:ueBhWkWll5v",
                    fields: "*",
                    paging: false,
                },
            }),
        );

        return {
            program,
            organisationUnits: me.organisationUnits,
            programRules,
            programRuleVariables,
            serviceTypes: options,
        };
    },
});

function RootRouteComponent() {
    const { engine } = RootRoute.useRouteContext();
    const navigate = RootRoute.useNavigate();
    const { organisationUnits } = RootRoute.useLoaderData();
    return (
        <TrackerContext.Provider
            options={{
                input: { engine, navigate, organisationUnits },
            }}
        >
            <Flex
                vertical
                style={{
                    height: "calc(100vh - 48px)",
                    minHeight: "calc(100vh - 48px)",
                    padding: 10,
                }}
            >
                <Outlet />
            </Flex>
        </TrackerContext.Provider>
    );
}
