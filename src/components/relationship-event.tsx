import { Form, Row, Tabs } from "antd";
import React, { useCallback, useEffect } from "react";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { DataElementField } from "./data-element-field";

export default function RelationshipEvent({ section }: { section: string }) {
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
    const relationships = TrackerContext.useSelector(
        (state) => state.context.trackedEntity.relationships,
    );

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
    const childTrackedEntity = TrackerContext.useSelector(
        (state) => state.context.childTrackedEntity,
    );

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
            attributeValues: childTrackedEntity.attributes,
            ruleResultKey: "childEventRuleResults",
            enrollment: childTrackedEntity.enrollment,
            ruleResultUpdateKey: "childEvent",
            updateKey: "dataValues",
        });
    }, [
        childEventForm,
        trackerActor,
        programRules,
        programRuleVariables,
        childEvent.programStage,
        childTrackedEntity.attributes,
    ]);

    useEffect(() => {
        trackerActor.send({
            type: "SET_CHILD_EVENT",
            childEvent: {
                ...childEvent,
                dataValues: {
                    ...childEvent.dataValues,
                    UuxHHVp5CnF:
                        section === "Maternity" ? "Newborn" : "Postnatal",
                },
            },
        });
        trackerActor.send({
            type: "EXECUTE_PROGRAM_RULES",
            programRules: programRules,
            programRuleVariables: programRuleVariables,
            programStage: childEvent.programStage,
            dataValues: childEvent.dataValues,
            attributeValues: childTrackedEntity.attributes,
            ruleResultKey: "childEventRuleResults",
            enrollment: childTrackedEntity.enrollment,
            ruleResultUpdateKey: "childEvent",
            updateKey: "dataValues",
        });
    }, [childEvent.event, section]);

    useEffect(() => {
        if (Object.keys(ruleResult.assignments).length > 0) {
            childEventForm.setFieldsValue(ruleResult.assignments);
        }
    }, [ruleResult, childEventForm]);
    return (
        <Tabs
            items={relationships.map((relationship) => ({
                key: relationship.relationship,
                label: relationship.to.trackedEntity.createdAt,
                children: (
                    <Form
                        form={childEventForm}
                        layout="vertical"
                        // onFinish={onVisitSubmit}
                        style={{ margin: 0, padding: 0 }}
                        initialValues={{
                            ...childEvent.dataValues,
                            occurredAt: childEvent.occurredAt,
                        }}
                    >
                        <Row gutter={24}>
                            {currentSection.dataElements.flatMap(
                                (dataElement) => {
                                    const currentDataElement = dataElements.get(
                                        dataElement.id,
                                    );
                                    const {
                                        compulsory = false,
                                        desktopRenderType,
                                    } =
                                        currentDataElements.get(
                                            dataElement.id,
                                        ) || {};

                                    const optionSet =
                                        currentDataElement?.optionSet?.id ?? "";

                                    const hiddenOptions =
                                        ruleResult.hiddenOptions[
                                            dataElement.id
                                        ];

                                    const shownOptionGroups =
                                        ruleResult.shownOptionGroups[
                                            dataElement.id
                                        ] || new Set<string>();

                                    let finalOptions = optionSets
                                        .get(optionSet)
                                        ?.flatMap((o) => {
                                            if (hiddenOptions?.has(o.id)) {
                                                return [];
                                            }
                                            return o;
                                        });

                                    if (
                                        ruleResult.hiddenFields.has(
                                            dataElement.id,
                                        )
                                    ) {
                                        return [];
                                    }

                                    if (shownOptionGroups.size > 0) {
                                        const currentOptions =
                                            optionGroups.get(
                                                shownOptionGroups
                                                    .values()
                                                    .next().value,
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
                                            desktopRenderType={
                                                desktopRenderType!
                                            }
                                            finalOptions={finalOptions}
                                            messages={messages}
                                            warnings={warnings}
                                            errors={errors}
                                            required={compulsory}
                                            key={dataElement.id}
                                            form={childEventForm}
                                            onTriggerProgramRules={
                                                handleTriggerProgramRules
                                            }
                                        />
                                    );
                                },
                            )}
                        </Row>
                    </Form>
                ),
            }))}
        />
    );
}
