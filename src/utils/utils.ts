import { TrackedEntityResponse } from "../schemas";

export const flattenTrackedEntityResponse = (te: TrackedEntityResponse) => {
    return te.trackedEntities.flatMap(({ attributes, ...rest }) => {
        return attributes.reduce(
            (acc, attr) => {
                acc[attr.displayName] = attr.value;
                return acc;
            },
            { ...rest },
        );
    });
};
