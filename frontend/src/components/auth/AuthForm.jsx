import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const authSchema = z.object({
    username: z.string().min(2, 'Username must be at least 2 characters').optional(),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default function AuthForm({ type, onSubmit, submitLabel, isSubmitting, submitError }) {
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(authSchema),
        defaultValues: {
            username: '',
            email: '',
            password: '',
        },
    })

    return (
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {type === 'register' && (
                <label className="field">
                    <span>Username</span>
                    <input type="text" placeholder="Your username" {...register('username')} />
                    {errors.username && <small>{errors.username.message}</small>}
                </label>
            )}

            <label className="field">
                <span>Email</span>
                <input type="email" placeholder="you@example.com" {...register('email')} />
                {errors.email && <small>{errors.email.message}</small>}
            </label>

            <label className="field">
                <span>Password</span>
                <input type="password" placeholder="••••••••" {...register('password')} />
                {errors.password && <small>{errors.password.message}</small>}
            </label>

            {submitError && <div className="inline-error">{submitError}</div>}

            <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : submitLabel}
            </button>
        </form>
    )
}
