import { Form, Row } from "antd";
import React, { useCallback, useEffect } from "react";
import { useEventAutoSave } from "../hooks/useEventAutoSave";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { BasicTrackedEntity } from "../schemas";
import { generateUid } from "../utils/id";
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
    const trackerActor = TrackerContext.useActorRef();
    const mainEvent = TrackerContext.useSelector(
        (state) => state.context.mainEvent,
    );
    const occurredAt = mainEvent.occurredAt;

    const [stage] = program.programStages.filter(
        ({ id }) => id === "K2nxbE9ubSs",
    );

    const [currentSection] = stage.programStageSections.filter(
        ({ name }) => name === "Child Health Services",
    );

    const ruleResult = TrackerContext.useSelector(
        (state) => state.context.childEventRuleResults,
    );

    const childEvent = TrackerContext.useSelector(
        (state) => state.context.childEvent,
    );

    const { triggerAutoSave, savingState, errorMessage, isEventCreated } =
        useEventAutoSave({
            form: childEventForm,
            event: childEvent,
            trackerActor,
            ruleResult: ruleResult,
            onEventCreated: (newEventId) => {
                trackerActor.send({
                    type: "UPDATE_EVENT_ID",
                    oldId: childEvent.event,
                    newId: newEventId,
                });
            },
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
        const allValues = childEventForm.getFieldsValue();
        trackerActor.send({
            type: "EXECUTE_PROGRAM_RULES",
            dataValues: allValues,
            programRules,
            programRuleVariables,
            programStage: childEvent.programStage,
            attributeValues: child.attributes.reduce((acc, attr) => {
                acc[attr.attribute] = attr.value;
                return acc;
            }, {}),
            ruleResultKey: "childEventRuleResults",
            enrollment: child.enrollments[0],
            ruleResultUpdateKey: "childEvent",
            updateKey: "dataValues",
        });
    }, [
        childEventForm,
        trackerActor,
        programRules,
        programRuleVariables,
        childEvent.programStage,
        child,
    ]);

    useEffect(() => {
        // Safety check: ensure child has enrollments
        if (!child.enrollments || child.enrollments.length === 0) {
            console.warn("⚠️ Child has no enrollments:", child);
            return;
        }

        // Create relationship between main event and child event (if child event is being created for the first time)
        const relationship = childEvent.event.startsWith("temp")
            ? {
                  relationship: generateUid(),
                  relationshipType: "B1XX9INzieq", // Event-to-Event relationship type
                  from: {
                      event: {
                          event: mainEvent.event, // Main/parent event ID
                      },
                  },
                  to: {
                      event: {
                          event: childEvent.event, // Child event ID
                      },
                  },
              }
            : undefined;

        trackerActor.send({
            type: "SET_CHILD_EVENT",
            childEvent: {
                ...childEvent,
                dataValues: {
                    ...childEvent.dataValues,
                    UuxHHVp5CnF:
                        section === "Maternity" ? "Newborn" : "Postnatal",

                    mrKZWf2WMIC: "Child Health Services",
                    occurredAt,
                },
                trackedEntity: child.trackedEntity,
                enrollment: child.enrollments[0].enrollment,
                program: child.enrollments[0].program,
                orgUnit: child.enrollments[0].orgUnit,
                relationships: relationship ? [relationship] : childEvent.relationships || [],
            },
        });
        trackerActor.send({
            type: "EXECUTE_PROGRAM_RULES",
            programRules: programRules,
            programRuleVariables: programRuleVariables,
            programStage: childEvent.programStage,
            dataValues: {
                ...childEvent.dataValues,
                UuxHHVp5CnF: section === "Maternity" ? "Newborn" : "Postnatal",
                mrKZWf2WMIC: "Child Health Services",
								occurredAt,
            },
            attributeValues: child.attributes.reduce((acc, attr) => {
                acc[attr.attribute] = attr.value;
                return acc;
            }, {}),
            ruleResultKey: "childEventRuleResults",
            enrollment: child.enrollments[0],
            ruleResultUpdateKey: "childEvent",
            updateKey: "dataValues",
        });
    }, [childEvent.event, section]);

    useEffect(() => {
        if (Object.keys(ruleResult.assignments).length > 0) {
            childEventForm.setFieldsValue(ruleResult.assignments);
            const stageDataElementIds = new Set(
                stage.programStageDataElements.map(
                    (psde) => psde.dataElement.id,
                ),
            );
            Object.entries(ruleResult.assignments).forEach(([key, value]) => {
                if (stageDataElementIds.has(key)) {
                    triggerAutoSave(key, value);
                }
            });
        }
    }, [
        ruleResult,
        childEventForm,
        isEventCreated,
        triggerAutoSave,
        stage.programStageDataElements,
        childEvent,
        child,
    ]);

    return (
        <Form
            form={childEventForm}
            layout="vertical"
            // onFinish={onVisitSubmit}
            style={{ margin: 0, padding: 0 }}
            initialValues={{
                ...childEvent.dataValues,
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
                            onAutoSave={triggerAutoSave}
                        />
                    );
                })}
            </Row>
        </Form>
    );
}
