import type { FormInstance } from "antd";
import { Card, Row } from "antd";
import React from "react";
import { useProgramRules } from "../hooks/useProgramRules";
import { RootRoute } from "../routes/__root";
import { ProgramStage, ProgramStageSection } from "../schemas";
import { calculateColSpan } from "../utils/utils";
import { DataElementField } from "./data-element-field";
import RelationshipEvent from "./relationship-event";

export default function SectionCapture({
    section,
    stage,
    ruleResult,
    form,
    handleTriggerProgramRules,
    updateDataValue,
}: {
    section: ProgramStageSection;
    stage: ProgramStage;
    ruleResult: ReturnType<typeof useProgramRules>["ruleResult"];
    form: FormInstance;
    handleTriggerProgramRules: () => void;
    updateDataValue: (dataElementId: string, value: any) => void;
}) {
    const { dataElements, optionGroups, optionSets } =
        RootRoute.useLoaderData();

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
    return (
        <Card>
            <Row gutter={24}>
                {section.dataElements.flatMap((dataElement) => {
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
                            span={calculateColSpan(
                                section.dataElements.length,
                                6,
                            )}
                            warnings={warnings}
                            errors={errors}
                            required={compulsory}
                            key={dataElement.id}
                            form={form}
                            onTriggerProgramRules={handleTriggerProgramRules}
                            onAutoSave={updateDataValue}
                        />
                    );
                })}
            </Row>
            {["Maternity", "Postnatal"].includes(section.name) && (
                <RelationshipEvent section={section.name} />
            )}
        </Card>
    );
}
