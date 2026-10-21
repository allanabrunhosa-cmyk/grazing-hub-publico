import type { ComponentProps } from "react";
export default function Link({ href, ...props }: ComponentProps<"a">) { return <a href={`/login.html?etapa=${href?.split("/").at(-1)}`} {...props} />; }
