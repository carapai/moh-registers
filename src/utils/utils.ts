import { FormItemProps, TableProps } from "antd";
import dayjs from "dayjs";
import {
	ProgramRule,
	ProgramRuleResult,
	ProgramRuleVariable,
	ProgramTrackedEntityAttribute,
	TrackedEntity,
	TrackedEntityResponse
} from "../schemas";
import { generateUid } from "./id";

export const flattenTrackedEntityResponse = (te: TrackedEntityResponse) => {
    return te.trackedEntities.flatMap(
        ({ attributes, enrollments, ...rest }) => {
            const [{ occurredAt, enrolledAt }] = enrollments;
            return {
                ...rest,
                attributes: attributes.reduce((acc, attr) => {
                    acc[attr.attribute] = attr.value;
                    return acc;
                }, {}),
                enrollment: { occurredAt, enrolledAt },
            };
        },
    );
};

export const flattenTrackedEntity = ({
    trackedEntity,
    attributes,
    enrollments,
    ...rest
}: TrackedEntity) => {
    const trackedEntityAttributes = attributes.reduce((acc, attr) => {
        acc[attr.attribute] = attr.value;
        return acc;
    }, {});

    const [{ events, attributes: eAttributes, ...enrollmentDetails }] =
        enrollments;
    const enrollmentAttrs = eAttributes.reduce((acc, attr) => {
        acc[attr.attribute] = attr.value;
        return acc;
    }, {});

    const flattenedEvents = events.map((event) => {
        const eventAttrs = event.dataValues.reduce((acc, dv) => {
            acc[dv.dataElement] = dv.value;
            return acc;
        }, {});
        return {
            ...event,
            dataValues: eventAttrs,
        };
    });
    return {
        ...rest,
        attributes: { ...trackedEntityAttributes, ...enrollmentAttrs },
        enrollment: enrollmentDetails,
        events: flattenedEvents,
        trackedEntity,
    };
};

export const getAttributes = (attributes: ProgramTrackedEntityAttribute[]) => {
    const columns: TableProps<
        ReturnType<typeof flattenTrackedEntityResponse>[number]
    >["columns"] = attributes.flatMap(({ trackedEntityAttribute, ...rest }) => {
        if (!rest.displayInList) {
            return [];
        }
        return {
            title:
                trackedEntityAttribute.displayFormName ||
                trackedEntityAttribute.name,
            dataIndex: ["attributes", trackedEntityAttribute.id],
            key: trackedEntityAttribute.id,
        };
    });

    return columns;
};

export function executeProgramRules({
    programRules,
    programRuleVariables,
    dataValues,
    attributeValues = {},
}: {
    programRules: ProgramRule[];
    programRuleVariables: ProgramRuleVariable[];
    dataValues: Record<string, any>;
    attributeValues?: Record<string, any>;
}): ProgramRuleResult {
    const variableValues: Record<string, any> = {};

    // Process program rule variables
    for (const variable of programRuleVariables) {
        let value: any = null;

        // Check for data element
        if (
            variable.dataElement &&
            dataValues.hasOwnProperty(variable.dataElement.id)
        ) {
            value = dataValues[variable.dataElement.id];
        }
        // Check for tracked entity attribute
        else if (
            variable.trackedEntityAttribute &&
            attributeValues.hasOwnProperty(variable.trackedEntityAttribute.id)
        ) {
            value = attributeValues[variable.trackedEntityAttribute.id];
        }

        variableValues[variable.name] = value ?? null;
    }

    // D2 function implementations
    const d2Functions = {
        hasValue: (varName: string): boolean => {
            const val = variableValues[varName];
            return val !== null && val !== undefined && val !== "";
        },

        contains: (text: string, substring: string): boolean => {
            if (text === null || text === undefined) return false;
            return String(text).includes(String(substring));
        },

        startsWith: (text: string, prefix: string): boolean => {
            if (text === null || text === undefined) return false;
            return String(text).startsWith(String(prefix));
        },

        endsWith: (text: string, suffix: string): boolean => {
            if (text === null || text === undefined) return false;
            return String(text).endsWith(String(suffix));
        },

        countIfValue: (varName: string, valueToCompare: any): number => {
            const val = variableValues[varName];
            return val === valueToCompare ? 1 : 0;
        },

        countIfZeroPos: (varName: string): number => {
            const val = variableValues[varName];
            const num = Number(val);
            return !isNaN(num) && num >= 0 ? 1 : 0;
        },

        validatePattern: (value: string, pattern: string): boolean => {
            try {
                const regex = new RegExp(pattern);
                return regex.test(String(value));
            } catch {
                return false;
            }
        },

        left: (text: string, numChars: number): string => {
            return String(text).substring(0, numChars);
        },

        right: (text: string, numChars: number): string => {
            const str = String(text);
            return str.substring(str.length - numChars);
        },

        substring: (text: string, start: number, end: number): string => {
            return String(text).substring(start, end);
        },

        split: (text: string, delimiter: string, index: number): string => {
            const parts = String(text).split(delimiter);
            return parts[index] || "";
        },

        length: (text: string): number => {
            return String(text).length;
        },

        concatenate: (...args: any[]): string => {
            return args.map((a) => String(a)).join("");
        },

        daysBetween: (date1: string, date2: string): number => {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
            const diffTime = Math.abs(d2.getTime() - d1.getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        },

        weeksBetween: (date1: string, date2: string): number => {
            return Math.floor(d2Functions.daysBetween(date1, date2) / 7);
        },

        monthsBetween: (date1: string, date2: string): number => {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
            return (
                (d2.getFullYear() - d1.getFullYear()) * 12 +
                (d2.getMonth() - d1.getMonth())
            );
        },

        yearsBetween: (date1: string, date2: string): number => {
            const d1 = new Date(date1);
            const d2 = new Date(date2);
            if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
            return d2.getFullYear() - d1.getFullYear();
        },

        addDays: (date: string, days: number): string => {
            const d = new Date(date);
            if (isNaN(d.getTime())) return date;
            d.setDate(d.getDate() + days);
            return d.toISOString().split("T")[0];
        },

        floor: (value: number): number => {
            return Math.floor(Number(value));
        },

        ceil: (value: number): number => {
            return Math.ceil(Number(value));
        },

        round: (value: number): number => {
            return Math.round(Number(value));
        },

        modulus: (dividend: number, divisor: number): number => {
            return Number(dividend) % Number(divisor);
        },

        zing: (value: number): number => {
            return Math.max(0, Number(value));
        },

        oizp: (value: number): number => {
            return Number(value) >= 0 ? 1 : 0;
        },

        zpvc: (...values: number[]): number => {
            let sum = 0;
            for (const val of values) {
                const num = Number(val);
                if (!isNaN(num) && num > 0) {
                    sum += num;
                }
            }
            return sum;
        },

        condition: (
            condition: boolean,
            trueValue: any,
            falseValue: any,
        ): any => {
            return condition ? trueValue : falseValue;
        },

        count: (varName: string): number => {
            const val = variableValues[varName];
            if (val === null || val === undefined || val === "") return 0;
            return 1;
        },

        countIfCondition: (condition: boolean): number => {
            return condition ? 1 : 0;
        },

        hasDataValue: (dataElementId: string): boolean => {
            return (
                dataValues.hasOwnProperty(dataElementId) &&
                dataValues[dataElementId] !== null &&
                dataValues[dataElementId] !== undefined &&
                dataValues[dataElementId] !== ""
            );
        },

        inOrgUnitGroup: (groupId: string): boolean => {
            console.warn("inOrgUnitGroup not fully implemented");
            return false;
        },
    };

    // Helper function to get and format variable/attribute value
    const getFormattedValue = (name: string): string => {
        const val = variableValues[name];
        if (val === null || val === undefined) {
            return "''";
        }
        if (typeof val === "boolean") {
            return String(val);
        }
        if (typeof val === "number") {
            return String(val);
        }
        const stringVal = String(val);
        const escaped = stringVal.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        return `'${escaped}'`;
    };

    // Step 2: Safely evaluate rule condition with d2 function support
    const evaluateCondition = (condition: string): boolean => {
        // First replace d2: function calls with JavaScript function calls
        let processedCondition = condition ?? "";

        // Replace d2:functionName(...) with d2Functions.functionName(...)
        processedCondition = processedCondition.replace(
            /d2:(\w+)\s*\(\s*([^)]+)\s*\)/g,
            (match, funcName, args) => {
                // Process arguments
                const processedArgs = args
                    .split(",")
                    .map((arg: string) => {
                        arg = arg.trim();
                        // Functions that need variable name instead of value
                        const needsVarName = [
                            "hasValue",
                            "count",
                            "countIfValue",
                            "countIfZeroPos",
                        ].includes(funcName);

                        // Handle variable references #{varName} or A{attributeName}
                        const varMatch = arg.match(/^[#A]\{([^}]+)\}$/);
                        if (varMatch) {
                            const varName = varMatch[1];
                            if (needsVarName) {
                                return `'${varName}'`;
                            } else {
                                return getFormattedValue(varName);
                            }
                        }

                        // If it's already quoted, keep as is
                        if (arg.match(/^['"].*['"]$/)) {
                            return arg;
                        }
                        // If it's a number, keep as is
                        if (!isNaN(Number(arg)) && arg !== "") {
                            return arg;
                        }
                        // If it's a boolean
                        if (arg === "true" || arg === "false") {
                            return arg;
                        }
                        // Otherwise quote it
                        return `'${arg}'`;
                    })
                    .join(", ");

                return `d2Functions.${funcName}(${processedArgs})`;
            },
        );

        // Replace variable references: #{varName} for data elements
        processedCondition = processedCondition.replace(
            /#\{([^}]+)\}/g,
            (_, name) => {
                return getFormattedValue(name);
            },
        );

        // Replace attribute references: A{attributeName} for tracked entity attributes
        processedCondition = processedCondition.replace(
            /A\{([^}]+)\}/g,
            (_, name) => {
                return getFormattedValue(name);
            },
        );

        try {
            // Normalize comparison operators
            let parts = processedCondition.split("'");
            for (let i = 0; i < parts.length; i += 2) {
                parts[i] = parts[i]
                    .replace(/!=/g, "!==")
                    .replace(/([^!<>=])={2}(?!=)/g, "$1===")
                    .replace(/([^!<>=])=(?!=)/g, "$1===");
            }
            const normalizedCond = parts.join("'");
            // Create function with d2Functions and variableValues in scope
            const func = new Function(
                "d2Functions",
                "variableValues",
                `return (${normalizedCond})`,
            );
            const value = func(d2Functions, variableValues);
            return value;
        } catch (err) {
            console.warn(
                `Invalid condition: ${condition}`,
                processedCondition,
                err,
            );
            return false;
        }
    };

    // Step 3: Run through rules and collect actions
    const result: ProgramRuleResult = {
        assignments: {},
        hiddenFields: new Set(),
        shownFields: new Set(),
        hiddenSections: new Set(),
        shownSections: new Set(),
        hiddenOptions: {},
        shownOptions: {},
        hiddenOptionGroups: {},
        shownOptionGroups: {},
        messages: [],
        warnings: [],
    };

    for (const rule of programRules) {
        const isTrue = evaluateCondition(rule.condition);
        if (!isTrue) continue;

        for (const action of rule.programRuleActions) {
            switch (action.programRuleActionType) {
                case "ASSIGN":
                    if (action.dataElement) {
                        result.assignments[action.dataElement.id] =
                            action.value;
                    }
                    break;

                case "HIDEFIELD":
                    if (action.dataElement) {
                        result.hiddenFields.add(action.dataElement.id);
                        result.assignments[action.dataElement.id] = "";
                    }
                    break;

                case "SHOWFIELD":
                    if (action.dataElement) {
                        result.shownFields.add(action.dataElement.id);
                    }
                    break;

                case "HIDESECTION":
                    if (action.programStageSection) {
                        result.hiddenSections.add(
                            action.programStageSection.id,
                        );
                    }
                    break;

                case "SHOWSECTION":
                    if (action.programStageSection) {
                        result.shownSections.add(action.programStageSection.id);
                    }
                    break;

                case "HIDEOPTION":
                    {
                        const targetId =
                            action.dataElement?.id ||
                            action.trackedEntityAttribute?.id;
                        if (targetId && action.option) {
                            if (!result.hiddenOptions[targetId]) {
                                result.hiddenOptions[targetId] = new Set();
                            }
                            result.hiddenOptions[targetId].add(
                                action.option.id,
                            );
                        }
                    }
                    break;

                case "SHOWOPTION":
                    {
                        const targetId =
                            action.dataElement?.id ||
                            action.trackedEntityAttribute?.id;
                        if (targetId && action.option) {
                            if (!result.shownOptions[targetId]) {
                                result.shownOptions[targetId] = new Set();
                            }
                            result.shownOptions[targetId].add(action.option.id);
                            console.log(
                                "Shown option:",
                                action.option.id,
                                "for field:",
                                targetId,
                            );
                        }
                    }
                    break;

                case "HIDEOPTIONGROUP":
                    {
                        const targetId =
                            action.dataElement?.id ||
                            action.trackedEntityAttribute?.id;
                        if (targetId && action.optionGroup) {
                            if (!result.hiddenOptionGroups[targetId]) {
                                result.hiddenOptionGroups[targetId] = new Set();
                            }
                            result.hiddenOptionGroups[targetId].add(
                                action.optionGroup.id,
                            );
                        }
                    }
                    break;

                case "SHOWOPTIONGROUP":
                    {
                        const targetId =
                            action.dataElement?.id ||
                            action.trackedEntityAttribute?.id;
                        if (targetId && action.optionGroup) {
                            if (!result.shownOptionGroups[targetId]) {
                                result.shownOptionGroups[targetId] = new Set();
                            }
                            result.shownOptionGroups[targetId].add(
                                action.optionGroup.id,
                            );
                        }
                    }
                    break;

                case "DISPLAYTEXT":
                    if (action.value) {
                        result.messages.push(action.value);
                    }
                    break;

                case "ERROR":
                    if (action.value) {
                        result.messages.push(`Error: ${action.value}`);
                    }
                    break;

                case "SHOWWARNING":
                    if (action.value) {
                        result.warnings.push(action.value);
                    }
                    break;
            }
        }
    }

    return result;
}

export const isDate = (valueType: string | undefined) => {
    return ["DATE", "DATETIME", "TIME", "AGE"].includes(valueType || "");
};

export const isNumber = (valueType: string | undefined) => {
    return [
        "NUMBER",
        "INTEGER",
        "INTEGER_POSITIVE",
        "INTEGER_NEGATIVE",
        "PERCENTAGE",
        "UNIT_INTERVAL",
    ].includes(valueType || "");
};

export const createEmptyTrackedEntity = ({
    orgUnit,
}: {
    orgUnit: string;
}): ReturnType<typeof flattenTrackedEntity> => {
    const trackedEntity = generateUid();
    return {
        orgUnit,
        attributes: {},
        enrollment: {
            createdAt: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
            program: "ueBhWkWll5v",
            deleted: false,
            orgUnit,
            trackedEntity,
            enrollment: generateUid(),
            enrolledAt: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
            occurredAt: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
            status: "ACTIVE",
            updatedAt: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
            followUp: false,
        },
        events: [],
        trackedEntityType: "QG9qZrGHLzV",
        createdAt: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        updatedAt: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        deleted: false,
        inactive: false,
        createdAtClient: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
        potentialDuplicate: false,
        trackedEntity,
    };
};

export const createEmptyEvent = ({
    orgUnit,
    program,
    trackedEntity,
    enrollment,
    programStage,
}: {
    orgUnit: string;
    program: string;
    trackedEntity: string;
    enrollment: string;
    programStage: string;
}): ReturnType<typeof flattenTrackedEntity>["events"][number] => {
    const eventId = generateUid();
    return {
        event: eventId,
        program,
        programStage,
        orgUnit,
        trackedEntity,
        enrollment,
        dataValues: {},
        status: "ACTIVE",
        occurredAt: dayjs().format("YYYY-MM-DD"),
        followUp: false,
        deleted: false,
        createdAt: dayjs().format("YYYY-MM-DD"),
        updatedAt: dayjs().format("YYYY-MM-DD"),
    };
};

export const createNormalize = (valueType: string | undefined) => {
    const normalize: FormItemProps["normalize"] = (value) => {
        if (isDate(valueType) && dayjs.isDayjs(value)) {
            return value.format("YYYY-MM-DD");
        } else if (value && valueType === "MULTI_TEXT") {
            return Array.isArray(value) ? value.join(",") : value;
        }
        return value;
    };
    return normalize;
};
export const createGetValueProps = (valueType: string | undefined) => {
    const getValueProps: FormItemProps["getValueProps"] = (value) => {
        if (isDate(valueType) || valueType === "MULTI_TEXT") {
            if (value && isDate(valueType)) {
                return {
                    value: value ? dayjs(value) : null,
                };
            }
            if (value) {
                if (typeof value === "string") {
                    return {
                        value: value ? value.split(",").filter(Boolean) : [],
                    };
                }
                if (Array.isArray(value)) {
                    return { value };
                }
                return { value: [] };
            }
        }
        return { value };
    };
    return getValueProps;
};
