import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFamilyMember } from '../services/storage/familyMemberRepository';
import { renderApp } from '../test/renderApp';

describe('Liabilities page', () => {
  it('asks for a family member first when there are none', async () => {
    const user = userEvent.setup();
    renderApp('/liabilities');
    await user.click(await screen.findByRole('button', { name: 'Add a liability' }));
    expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Add a family member' })).toBeInTheDocument();
  });

  it('adds, edits and deletes a liability with validation', async () => {
    await createFamilyMember({ name: 'Person A', relationship: 'Self', isActive: true });
    const user = userEvent.setup();
    renderApp('/liabilities');

    await user.click(await screen.findByRole('button', { name: 'Add a liability' }));
    let dialog = screen.getByRole('dialog', { name: 'Add liability' });
    await user.click(within(dialog).getByRole('button', { name: 'Add liability' }));
    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a type')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a valid outstanding amount')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Name/), 'Example Home Loan');
    await user.selectOptions(within(dialog).getByLabelText(/Type/), 'Home Loan');
    expect(within(dialog).getByLabelText(/Owed by/)).toHaveDisplayValue('Person A'); // only member, pre-selected
    await user.type(within(dialog).getByLabelText(/Outstanding/), '2,00,000');
    await user.click(within(dialog).getByRole('button', { name: 'Add liability' }));
    await waitFor(() => expect(screen.getByTestId('liabilities-total')).toHaveTextContent('₹2,00,000'));

    await user.click(screen.getByRole('button', { name: 'Edit Example Home Loan' }));
    dialog = screen.getByRole('dialog', { name: 'Edit liability' });
    const amount = within(dialog).getByLabelText(/Outstanding/);
    await user.clear(amount);
    await user.type(amount, '150000');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByTestId('liabilities-total')).toHaveTextContent('₹1,50,000'));

    await user.click(screen.getByRole('button', { name: 'Delete Example Home Loan' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('No liabilities')).toBeInTheDocument();
  });
});
