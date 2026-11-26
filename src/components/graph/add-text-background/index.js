import { uniqueId } from 'lodash-es';

const addTextBackground = defs => {
  const id = uniqueId('background-');

  const filter = defs
    .append('filter')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', 1)
    .attr('height', 1)
    .attr('id', id);
  filter.append('feFlood').style('flood-color', 'var(--mui-palette-background-paper)');
  filter.append('feComposite').attr('in', 'SourceGraphic');
  return `url(#${id})`;
};

export default addTextBackground;
