import { Form, Row } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import React, { useCallback, useEffect } from "react";
import { db } from "../db";
import { useDexieEventForm } from "../hooks/useDexieEventForm";
import { useProgramRulesWithDexie } from "../hooks/useProgramRules";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { BasicTrackedEntity } from "../schemas";
import { calculateColSpan } from "../utils/utils";
import { DataElementField } from "./data-element-field";

export default function Relation({
    section,
    child,
}: {
    section: string;
    child: BasicTrackedEntity;
}) {
    const {
        program,
        dataElements,
        optionGroups,
        optionSets,
        programRuleVariables,
        programRules,
    } = RootRoute.useLoaderData();

    const [childEventForm] = Form.useForm();
    const mainEventId = TrackerContext.useSelector(
        (state) => state.context.mainEvent?.event || null,
    );
    const mainEvent = useLiveQuery(
        async () => (mainEventId ? await db.events.get(mainEventId) : null),
        [mainEventId],
    );
    const occurredAt = mainEvent?.occurredAt;

    const [stage] = program.programStages.filter(
        ({ id }) => id === "K2nxbE9ubSs",
    );

    const [currentSection] = stage.programStageSections.filter(
        ({ name }) => name === "Child Health Services",
    );

    const childEvent = TrackerContext.useSelector(
        (state) => state.context.childEvent,
    );

    const { updateDataValue, updateDataValues } = useDexieEventForm({
        currentEvent: childEvent,
    });

    const { ruleResult, executeAndApplyRules } = useProgramRulesWithDexie({
        form: childEventForm,
        programRules,
        programRuleVariables,
        programStage: childEvent?.programStage || "K2nxbE9ubSs",
        trackedEntityAttributes: child.attributes.reduce(
            (acc, attr) => {
                acc[attr.attribute] = attr.value;
                return acc;
            },
            {} as Record<string, any>,
        ),
        enrollment: child.enrollments[0],
        onAssignments: updateDataValues,
        applyAssignmentsToForm: true,
        persistAssignments: true,
        program: program.id,
    });

    const currentDataElements = new Map(
        stage.programStageDataElements.map((psde) => [
            psde.dataElement.id,
            {
                allowFutureDate: psde.allowFutureDate,
                renderOptionsAsRadio: psde.renderType !== undefined,
                compulsory: psde.compulsory,
                desktopRenderType: psde.renderType?.DESKTOP?.type,
            },
        ]),
    );
    const handleTriggerProgramRules = useCallback(() => {
        executeAndApplyRules();
    }, [executeAndApplyRules]);

    useEffect(() => {
        if (!child.enrollments || child.enrollments.length === 0) {
            return;
        }
        if (!childEvent || !mainEvent) return;

        const initializeChildEvent = async () => {
            const initialDataValues = {
                ...childEvent.dataValues,
                UuxHHVp5CnF: section === "Maternity" ? "Newborn" : "Postnatal",
                mrKZWf2WMIC: "Child Health Services",
                occurredAt,
            };

            await updateDataValues(initialDataValues);

            executeAndApplyRules(initialDataValues);
        };

        initializeChildEvent();
    }, [childEvent?.event, section]);

    return (
        <Form
            form={childEventForm}
            layout="vertical"
            // onFinish={onVisitSubmit}
            style={{ margin: 0, padding: 0 }}
            initialValues={{
                ...childEvent?.dataValues,
                occurredAt,
                UuxHHVp5CnF: section === "Maternity" ? "Newborn" : "Postnatal",
                mrKZWf2WMIC: "Child Health Services",
            }}
        >
            <Row gutter={24}>
                {currentSection.dataElements.flatMap((dataElement) => {
                    const currentDataElement = dataElements.get(dataElement.id);
                    const { compulsory = false, desktopRenderType } =
                        currentDataElements.get(dataElement.id) || {};

                    const optionSet = currentDataElement?.optionSet?.id ?? "";

                    const hiddenOptions =
                        ruleResult.hiddenOptions[dataElement.id];

                    const shownOptionGroups =
                        ruleResult.shownOptionGroups[dataElement.id] ||
                        new Set<string>();

                    let finalOptions = optionSets
                        .get(optionSet)
                        ?.flatMap((o) => {
                            if (hiddenOptions?.has(o.id)) {
                                return [];
                            }
                            return o;
                        });

                    if (ruleResult.hiddenFields.has(dataElement.id)) {
                        return [];
                    }

                    if (shownOptionGroups.size > 0) {
                        const currentOptions =
                            optionGroups.get(
                                shownOptionGroups.values().next().value,
                            ) ?? [];
                        finalOptions = currentOptions.map(
                            ({ code, id, name }) => ({
                                id,
                                code,
                                name,
                                optionSet,
                            }),
                        );
                    }
                    const errors = ruleResult.errors.filter(
                        (msg) => msg.key === dataElement.id,
                    );
                    const messages = ruleResult.messages.filter(
                        (msg) => msg.key === dataElement.id,
                    );
                    const warnings = ruleResult.warnings.filter(
                        (msg) => msg.key === dataElement.id,
                    );

                    return (
                        <DataElementField
                            dataElement={currentDataElement!}
                            hidden={false}
                            desktopRenderType={desktopRenderType!}
                            finalOptions={finalOptions}
                            messages={messages}
                            warnings={warnings}
                            errors={errors}
                            required={compulsory}
                            key={dataElement.id}
                            form={childEventForm}
                            onTriggerProgramRules={handleTriggerProgramRules}
                            onAutoSave={updateDataValue}
                            span={calculateColSpan(
                                currentSection.dataElements.length,
                                6,
                            )}
                        />
                    );
                })}
            </Row>
        </Form>
    );
}
