// Set a smart TextLink component
const TextLink = ({ name, id, page, url }) => {
  // Set the targe URL depending on the different possible inputs
  let finalUrl = url;
  if (!finalUrl) finalUrl = page && `/#/${page}`;
  if (!finalUrl) finalUrl = id && `/#/help#${id}`;
  if (!finalUrl) throw new Error('Missing argument in TextLink component');
  // Set the link component
  return (<>
    <a href={finalUrl} target="_blank" rel="noreferrer noopener" >
      {name}
    </a>
  </>);
}

export default TextLink;