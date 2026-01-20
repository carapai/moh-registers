import {
    Checkbox,
    Col,
    DatePicker,
    Form,
    FormInstance,
    Input,
    InputNumber,
    Radio,
    Select,
} from "antd";
import React from "react";
import {
    DataElement,
    Message,
    OptionSet,
    RenderType,
    TrackedEntityAttribute,
} from "../schemas";
import { createGetValueProps, createNormalize, isDate } from "../utils/utils";
import DobPicker from "./dob-picker";
import VillageSelect from "./village-select";

export const DataElementField = React.memo<{
    dataElement: DataElement | TrackedEntityAttribute;
    hidden: boolean;
    finalOptions?: OptionSet["options"];
    errors: Array<Message>;
    messages: Array<Message>;
    warnings: Array<Message>;
    required: boolean;
    span?: number;
    form: FormInstance<any>;
    customLabel?: string;
    onTriggerProgramRules?: () => void;
    onAutoSave?: (dataElementId: string, value: any) => void;
    desktopRenderType?: RenderType["type"];
}>(
    ({
        dataElement,
        hidden,
        finalOptions,
        errors,
        messages,
        warnings,
        required,
        span = 8,
        form,
        customLabel,
        desktopRenderType,
        onTriggerProgramRules,
        onAutoSave,
    }) => {
        if (hidden) return null;
        // Determine if this field should trigger rules on blur or change
        const isTextInput =
            !dataElement.optionSetValue &&
            !["BOOLEAN", "AGE"].includes(dataElement.valueType ?? "") &&
            !isDate(dataElement.valueType);

        let element: React.ReactNode = (
            <Input
                onBlur={
                    isTextInput
                        ? (e) => {
                              onTriggerProgramRules?.();
                              onAutoSave?.(dataElement.id, e.target.value);
                          }
                        : undefined
                }
            />
        );
        if (dataElement.id === "oTI0DLitzFY") {
            element = (
                <VillageSelect
                    form={form}
                    watchFields={[
                        { fieldId: "XjgpfkoxffK", label: "District" },
                        {
                            fieldId: "PKuyTiVCR89",
                            label: "Subcounty",
                        },
                        { fieldId: "W87HAtUHJjB", label: "Parish" },
                    ]}
                    syncParentFields
                    allowDirectSearch
                    sortField="village_name"
                />
            );
        } else if (
            dataElement.optionSetValue &&
            dataElement.optionSet &&
            dataElement.valueType === "MULTI_TEXT"
        ) {
            element = (
                <Select
                    style={{ width: "100%" }}
                    options={finalOptions}
                    fieldNames={{
                        label: "name",
                        value: "code",
                    }}
                    allowClear
                    mode="multiple"
                    onChange={(value) => {
                        onTriggerProgramRules?.();
                        onAutoSave?.(dataElement.id, value);
                    }}
                    showSearch={{
                        filterOption: (input, option) =>
                            option
                                ? option.name
                                      .toLowerCase()
                                      .includes(input.toLowerCase()) ||
                                  option.code
                                      .toLowerCase()
                                      .includes(input.toLowerCase())
                                : false,
                    }}
                />
            );
        } else if (
            dataElement.optionSetValue &&
            dataElement.optionSet &&
            desktopRenderType &&
            ["VERTICAL_RADIOBUTTONS", "HORIZONTAL_RADIOBUTTONS"].includes(
                desktopRenderType,
            )
        ) {
            // Use Form.useWatch to track current value for unselect functionality
            const currentValue = Form.useWatch(dataElement.id, form);

            element = (
                <Radio.Group
                    vertical={desktopRenderType === "VERTICAL_RADIOBUTTONS"}
                    value={currentValue}
                    onChange={(e) => {
                        onTriggerProgramRules?.();
                        onAutoSave?.(dataElement.id, e.target.value);
                    }}
                >
                    {finalOptions?.map((o) => (
                        <Radio
                            key={o.code}
                            value={o.code}
                            onClick={(e) => {
                                // Allow clicking selected radio to deselect it
                                if (currentValue === o.code) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    form.setFieldValue(
                                        dataElement.id,
                                        undefined,
                                    );
                                    onTriggerProgramRules?.();
                                    onAutoSave?.(dataElement.id, undefined);
                                }
                            }}
                        >
                            {o.name}
                        </Radio>
                    ))}
                </Radio.Group>
            );
        } else if (dataElement.optionSetValue && dataElement.optionSet) {
            element = (
                <Select
                    style={{ width: "100%" }}
                    options={finalOptions}
                    fieldNames={{
                        label: "name",
                        value: "code",
                    }}
                    allowClear
                    onChange={(value) => {
                        onTriggerProgramRules?.();
                        onAutoSave?.(dataElement.id, value);
                    }}
                    showSearch={{
                        filterOption: (input, option) =>
                            option
                                ? option.name
                                      .toLowerCase()
                                      .includes(input.toLowerCase()) ||
                                  option.code
                                      .toLowerCase()
                                      .includes(input.toLowerCase())
                                : false,
                    }}
                />
            );
        } else if (dataElement.valueType === "BOOLEAN") {
            element = (
                <Checkbox
                    onChange={(e) => {
                        onTriggerProgramRules?.();
                        onAutoSave?.(dataElement.id, e.target.checked);
                    }}
                >
                    {dataElement.formName ?? dataElement.name}
                </Checkbox>
            );
        } else if (dataElement.valueType === "AGE") {
            element = (
                <DobPicker
                    form={form}
                    dataElement={dataElement}
                    onTriggerProgramRules={onTriggerProgramRules}
                    onAutoSave={onAutoSave}
                />
            );
        } else if (dataElement.valueType === "DATETIME") {
            element = (
                <DatePicker
                    style={{
                        width: "100%",
                    }}
                    showTime
                    onChange={(date) => {
                        onTriggerProgramRules?.();
                        onAutoSave?.(
                            dataElement.id,
                            date
                                ? date.format("YYYY-MM-DDTHH:mm:ss")
                                : undefined,
                        );
                    }}
                />
            );
        } else if (isDate(dataElement.valueType)) {
            element = (
                <DatePicker
                    style={{
                        width: "100%",
                    }}
                    onChange={(date) => {
                        onTriggerProgramRules?.();
                        onAutoSave?.(
                            dataElement.id,
                            date ? date.format("YYYY-MM-DD") : undefined,
                        );
                    }}
                />
            );
        } else if (dataElement.valueType === "LONG_TEXT") {
            element = (
                <Input.TextArea
                    rows={4}
                    onBlur={(e) => {
                        onTriggerProgramRules?.();
                        onAutoSave?.(dataElement.id, e.target.value);
                    }}
                />
            );
        } else if (
            ["NUMBER", "INTEGER", "INTEGER_POSITIVE"].includes(
                dataElement.valueType ?? "",
            )
        ) {
            element = (
                <InputNumber
                    style={{
                        width: "100%",
                    }}
                    onBlur={(e) => {
                        onTriggerProgramRules?.();
                        onAutoSave?.(
                            dataElement.id,
                            e.target.value ? Number(e.target.value) : undefined,
                        );
                    }}
                />
            );
        }

        return (
            <Col
                key={dataElement.id}
                sm={{ span: 24 }}
                md={{ span: 12 }}
                lg={{ span: 8 }}
                xs={{ span: 24 }}
                xl={{ span }}
            >
                <Form.Item
                    key={dataElement.id}
                    label={
                        dataElement.valueType === "BOOLEAN"
                            ? null
                            : customLabel ||
                              `${dataElement.formName || dataElement.name}`
                    }
                    name={dataElement.id}
                    required={required}
                    rules={[
                        {
                            required: required,
                            message: `${customLabel || dataElement.formName || dataElement.name} is required`,
                        },
                    ]}
                    getValueProps={createGetValueProps(dataElement.valueType)}
                    normalize={createNormalize(dataElement.valueType)}
                    extra={warnings.map((w) => w.content)}
                    help={
                        errors.length > 0
                            ? errors.map((e) => e.content).join(", ")
                            : undefined
                    }
                    validateStatus={errors.length > 0 ? "error" : undefined}
                    hasFeedback={errors.length > 0 || warnings.length > 0}
                    style={{ padding: 0, margin: 0 }}
                >
                    {element}
                </Form.Item>
            </Col>
        );
    },
);
