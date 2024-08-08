// Set a simpler TextLink component
const TextLink = ({ name, id, url }) => (
    <a
        href={id ? `/help#/help#${id}` : url}
        target="_blank"
        rel="noreferrer noopener"
    >
        {name}
    </a>
);

export default TextLink;