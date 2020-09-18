import { uniqueId } from 'lodash-es';

const addTextBackground = defs => {
  const id = uniqueId('background-');

  const filter = defs
    .append('filter')
    .attr('x', 0)
    .attr('y', 0.2)
    .attr('width', 1)
    .attr('height', 0.6)
    .attr('id', id);
  filter.append('feFlood').attr('flood-color', 'white');
  filter.append('feComposite').attr('in', 'SourceGraphic');
  return `url(#${id})`;
};

export default addTextBackground;
