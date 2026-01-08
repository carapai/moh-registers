import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import React, { useMemo } from "react";

import { Flex } from "antd";
import useApp from "antd/es/app/useApp";
import { groupBy } from "lodash";
import { AppHeader } from "../components/app-header";
import { SyncErrorBoundary } from "../components/sync-error-boundary";
import { db } from "../db";
import { createSyncManager } from "../db/sync";
import { TrackerContext } from "../machines/tracker";
import { resourceQueryOptions } from "../query-options";
import {
    DataElement,
    Program,
    ProgramRule,
    ProgramRuleVariable,
    TrackedEntityAttribute,
} from "../schemas";

export const RootRoute = createRootRouteWithContext<{
    queryClient: QueryClient;
    engine: ReturnType<typeof useDataEngine>;
}>()({
    component: RootRouteComponent,
    loader: async ({ context: { queryClient, engine } }) => {
        const me = await queryClient.ensureQueryData(
            resourceQueryOptions<{
                organisationUnits: {
                    id: string;
                    name: string;
                    level: number;
                    parent?: { id: string };
                    leaf: boolean;
                }[];
                id: string;
            }>({
                engine,
                resource: "me",
                params: {
                    fields: "id,organisationUnits[id,name,level,parent,leaf]",
                },
            }),
        );
        const prevDataElements = await db.dataElements.count();
        const prevAttributes = await db.trackedEntityAttributes.count();
        const prevProgramRules = await db.programRules.count();
        const prevProgramRuleVariables = await db.programRuleVariables.count();
        const prevOptionGroups = await db.optionGroups.count();
        const prevOptionSets = await db.optionSets.count();
        const prevPrograms = await db.programs.count();
        const prevVillages = await db.villages.count();

        if (
            prevDataElements === 0 ||
            prevAttributes === 0 ||
            prevProgramRules === 0 ||
            prevProgramRuleVariables === 0 ||
            prevOptionGroups === 0 ||
            prevOptionSets === 0 ||
            prevPrograms === 0 ||
            prevVillages === 0
        ) {
            const villages = await queryClient.ensureQueryData(
                resourceQueryOptions<any>({
                    engine,
                    resource: "dataStore/registers",
                    id: "villages",
                }),
            );
            const program = await queryClient.ensureQueryData(
                resourceQueryOptions<Program>({
                    engine,
                    resource: "programs",
                    id: "ueBhWkWll5v",
                    params: {
                        fields: "id,name,programSections[id,name,sortOrder,trackedEntityAttributes[id]],trackedEntityType[id,trackedEntityTypeAttributes[id]],programType,selectEnrollmentDatesInFuture,selectIncidentDatesInFuture,organisationUnits,programStages[id,repeatable,name,code,programStageDataElements[id,compulsory,dataElement[id],renderType,allowFutureDate],programStageSections[id,name,sortOrder,dataElements[id]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,displayInList,trackedEntityAttribute[id]]",
                    },
                }),
            );
            const { optionSets } = await queryClient.ensureQueryData(
                resourceQueryOptions<{
                    optionSets: {
                        id: string;
                        options: { id: string; name: string; code: string }[];
                    }[];
                }>({
                    engine,
                    resource: "optionSets",
                    params: {
                        fields: "id,options[id,name,code]",
                        paging: false,
                    },
                }),
            );
            const { dataElements } = await queryClient.ensureQueryData(
                resourceQueryOptions<{ dataElements: DataElement[] }>({
                    engine,
                    resource: "dataElements",
                    params: {
                        fields: "id,name,code,valueType,formName,optionSetValue,optionSet[id]",
                        paging: false,
                    },
                }),
            );

            const { trackedEntityAttributes } =
                await queryClient.ensureQueryData(
                    resourceQueryOptions<{
                        trackedEntityAttributes: TrackedEntityAttribute[];
                    }>({
                        engine,
                        resource: "trackedEntityAttributes",
                        params: {
                            fields: "id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,formName,optionSet[id]",
                            paging: false,
                        },
                    }),
                );
            const { programRules } = await queryClient.ensureQueryData(
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
            const { programRuleVariables } = await queryClient.ensureQueryData(
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
            const { optionGroups } = await queryClient.ensureQueryData(
                resourceQueryOptions<{
                    optionGroups: Array<{
                        id: string;
                        options: {
                            id: string;
                            name: string;
                            code: string;
                        }[];
                    }>;
                }>({
                    engine,
                    resource: "optionGroups",
                    params: {
                        fields: "id,options[id,name,code]",
                        paging: false,
                    },
                }),
            );

            const finalOptionGroups = optionGroups.flatMap((og) =>
                og.options.map((o) => ({
                    ...o,
                    optionGroup: og.id,
                })),
            );
            const finalOptionSets = optionSets.flatMap((os) =>
                os.options.map((o) => ({
                    ...o,
                    optionSet: os.id,
                })),
            );
            await db.programs.bulkPut([program]);
            await db.dataElements.bulkPut(dataElements);
            await db.trackedEntityAttributes.bulkPut(trackedEntityAttributes);
            await db.programRules.bulkPut(programRules);
            await db.programRuleVariables.bulkPut(programRuleVariables);
            await db.optionGroups.bulkPut(finalOptionGroups);
            await db.optionSets.bulkPut(finalOptionSets);
            await db.villages.bulkPut(villages);
            return {
                ...me,
                dataElements: new Map(dataElements.map((de) => [de.id, de])),
                trackedEntityAttributes: new Map(
                    trackedEntityAttributes.map((ta) => [ta.id, ta]),
                ),
                programRules: programRules,
                programRuleVariables: programRuleVariables,
                optionGroups: new Map(
                    Object.entries(
                        groupBy(finalOptionGroups, "optionGroup"),
                    ).map(([id, og]) => [id, og]),
                ),
                optionSets: new Map(
                    Object.entries(groupBy(finalOptionSets, "optionSet")).map(
                        ([id, os]) => [id, os],
                    ),
                ),
                program,
                villages,
            };
        }

        const dataElements = await db.dataElements.toArray();
        const trackedEntityAttributes =
            await db.trackedEntityAttributes.toArray();
        const programRules = await db.programRules.toArray();
        const programRuleVariables = await db.programRuleVariables.toArray();
        const optionGroups = await db.optionGroups.toArray();
        const optionSets = await db.optionSets.toArray();
        const programs = await db.programs.toArray();
        const villages = await db.villages.toArray();

        return {
            ...me,
            dataElements: new Map(dataElements.map((de) => [de.id, de])),
            trackedEntityAttributes: new Map(
                trackedEntityAttributes.map((ta) => [ta.id, ta]),
            ),
            programRules,
            programRuleVariables,
            optionGroups: new Map(
                Object.entries(groupBy(optionGroups, "optionGroup")).map(
                    ([id, og]) => [id, og],
                ),
            ),
            optionSets: new Map(
                Object.entries(groupBy(optionSets, "optionSet")).map(
                    ([id, os]) => [id, os],
                ),
            ),
            program: programs[0],
            villages,
        };
    },
});

function RootRouteComponent() {
    const { engine } = RootRoute.useRouteContext();
    const { message } = useApp();
    const navigate = RootRoute.useNavigate();
    const { organisationUnits } = RootRoute.useLoaderData();
    // Initialize sync manager (memoized to prevent recreation on re-renders)
    const syncManager = useMemo(() => {
        const manager = createSyncManager(engine);
        manager.startAutoSync(3000);
        return manager;
    }, [engine]);

    return (
        <SyncErrorBoundary
            onReset={() => {
                console.log("🔄 Error boundary reset");
                // Optionally restart sync manager
                syncManager.startAutoSync(30000);
            }}
        >
            <TrackerContext.Provider
                options={{
                    input: {
                        engine,
                        navigate,
                        organisationUnits,
                        syncManager,
                        message,
                    },
                }}
            >
                <Flex
                    vertical
                    style={{
                        height: "calc(100vh - 48px)",
                        minHeight: "calc(100vh - 48px)",
                        backgroundColor: "#f5f5f5",
                    }}
                >
                    <AppHeader title="MOH Registers" />
                    <Flex
                        vertical
                        style={{
                            height: "calc(100vh - 96px)",
                            minHeight: "calc(100vh - 96px)",
                            padding: 10,
                            overflowY: "auto",
                        }}
                    >
                        <Outlet />
                    </Flex>
                </Flex>
            </TrackerContext.Provider>
        </SyncErrorBoundary>
    );
}
