import { useDataEngine } from "@dhis2/app-runtime";
import { queryOptions } from "@tanstack/react-query";

export const resourceQueryOptions = <T>({
    engine,
    resource,
    params,
    id,
}: {
    engine: ReturnType<typeof useDataEngine>;
    resource: string;
    params: Record<string, any>;
    id?: string;
}) => {
    return queryOptions({
        queryKey: [resource, ...Object.values(params), id || ""],
        queryFn: async () => {
            const response = (await engine.query({
                resource: {
                    resource,
                    id,
                    params,
                },
            })) as { resource: T };
            return response.resource;
        },
    });
};
