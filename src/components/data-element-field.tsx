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
    TrackedEntityAttribute,
} from "../schemas";
import { createGetValueProps, createNormalize, isDate } from "../utils/utils";
import DobPicker from "./dob-picker";
import VillageSelect from "./village-select";

export const DataElementField = React.memo<{
    dataElement: DataElement | TrackedEntityAttribute;
    hidden: boolean;
    renderOptionsAsRadio: boolean;
    vertical: boolean;
    finalOptions?: OptionSet["options"];
    errors: Array<Message>;
    messages: Array<Message>;
    warnings: Array<Message>;
    required: boolean;
    span?: number;
    form: FormInstance<any>;
    customLabel?: string;
    onTriggerProgramRules?: () => void;
}>(
    ({
        dataElement,
        hidden,
        renderOptionsAsRadio,
        vertical,
        finalOptions,
        errors,
        messages,
        warnings,
        required,
        span = 8,
        form,
        customLabel,
        onTriggerProgramRules,
    }) => {
        if (hidden) return null;
        // Determine if this field should trigger rules on blur or change
        const isTextInput =
            !dataElement.optionSetValue &&
            !["BOOLEAN", "AGE"].includes(dataElement.valueType ?? "") &&
            !isDate(dataElement.valueType);

        let element: React.ReactNode = (
            <Input onBlur={isTextInput ? onTriggerProgramRules : undefined} />
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
                    onChange={onTriggerProgramRules}
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
            renderOptionsAsRadio
        ) {
            element = (
                <Radio.Group
                    vertical={vertical}
                    onChange={onTriggerProgramRules}
                >
                    {finalOptions?.map((o) => (
                        <Radio key={o.code} value={o.code}>
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
                    onChange={onTriggerProgramRules}
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
                <Checkbox onChange={onTriggerProgramRules}>
                    {dataElement.formName ?? dataElement.name}
                </Checkbox>
            );
        } else if (dataElement.valueType === "AGE") {
            element = (
                <DobPicker
                    form={form}
                    dataElement={dataElement}
                    onTriggerProgramRules={onTriggerProgramRules}
                />
            );
        } else if (isDate(dataElement.valueType)) {
            element = (
                <DatePicker
                    style={{
                        width: "100%",
                    }}
                    onChange={onTriggerProgramRules}
                />
            );
        } else if (dataElement.valueType === "LONG_TEXT") {
            element = (
                <Input.TextArea rows={4} onBlur={onTriggerProgramRules} />
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
                    onBlur={onTriggerProgramRules}
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
